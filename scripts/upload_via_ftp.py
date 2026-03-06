import argparse
import ftplib
import logging
import os
import sys
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

try:
    import pathspec
except ImportError:  # pragma: no cover
    pathspec = None  # type: ignore


logger = logging.getLogger("ftp_uploader")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Upload a project directory to an FTP server."
    )

    parser.add_argument(
        "--url",
        help="FTP url, e.g. ftp://user:pass@host:21/path",
    )
    parser.add_argument(
        "--host",
        help="FTP host (default from FTP_HOST)",
    )
    parser.add_argument(
        "--port",
        type=int,
        help="FTP port (default from FTP_PORT or 21)",
    )
    parser.add_argument(
        "--user",
        help="FTP username (default from FTP_USER)",
    )
    parser.add_argument(
        "--password",
        help="FTP password (default from FTP_PASS)",
    )
    parser.add_argument(
        "--remote-dir",
        help="Remote root directory on FTP (default from FTP_TARGET_DIR or /)",
    )
    parser.add_argument(
        "--project-root",
        type=str,
        default=".",
        help="Local project root to upload (default: current directory).",
    )

    return parser.parse_args()


def parse_ftp_url(url: str) -> Tuple[Optional[str], Optional[int], Optional[str], Optional[str], Optional[str]]:
    from urllib.parse import urlparse

    parsed = urlparse(url)
    host = parsed.hostname
    port = parsed.port
    user = parsed.username
    password = parsed.password
    # path like "/"
    remote_dir = parsed.path or "/"
    if not remote_dir.startswith("/"):
        remote_dir = "/" + remote_dir
    return host, port, user, password, remote_dir


def resolve_config(args: argparse.Namespace) -> Tuple[str, int, str, str, str, Path, Optional[Path]]:
    url_host = url_port = url_user = url_password = url_remote_dir = None
    if args.url:
        url_host, url_port, url_user, url_password, url_remote_dir = parse_ftp_url(args.url)

    env_host = os.getenv("FTP_HOST")
    env_port = os.getenv("FTP_PORT")
    env_user = os.getenv("FTP_USER")
    env_password = os.getenv("FTP_PASS")
    env_remote_dir = os.getenv("FTP_TARGET_DIR")

    host = args.host or env_host or url_host or "47.107.172.203"
    port = args.port or (int(env_port) if env_port else None) or url_port or 21
    user = args.user or env_user or url_user or "UniID"
    password = args.password or env_password or url_password or "aHmcRxMhcXFe"
    remote_dir = args.remote_dir or env_remote_dir or url_remote_dir or "/"

    if not host:
        raise SystemExit("FTP host is required but not provided.")
    if not user:
        raise SystemExit("FTP user is required but not provided.")
    if not password:
        raise SystemExit("FTP password is required but not provided.")

    project_root = Path(args.project_root).resolve()

    # allow .gitignore in project root or its parent repo root
    gitignore_local = project_root / ".gitignore"
    gitignore_parent = project_root.parent / ".gitignore"
    gitignore_path: Optional[Path] = None
    if gitignore_local.is_file():
        gitignore_path = gitignore_local
    elif gitignore_parent.is_file():
        gitignore_path = gitignore_parent

    return host, int(port), user, password, remote_dir, project_root, gitignore_path


def load_gitignore_spec(gitignore_path: Optional[Path], project_root: Path):
    if not gitignore_path or not gitignore_path.is_file():
        return None
    if pathspec is None:
        logger.warning(
            ".gitignore found at %s but 'pathspec' is not installed; ignoring .gitignore rules.",
            gitignore_path,
        )
        return None

    patterns = gitignore_path.read_text(encoding="utf-8").splitlines()
    base_dir = gitignore_path.parent
    # we always match against paths relative to base_dir
    spec = pathspec.PathSpec.from_lines("gitwildmatch", patterns)

    def is_ignored(path: Path) -> bool:
        try:
            rel = path.relative_to(base_dir)
        except ValueError:
            # path is outside the base_dir
            return False
        rel_str = str(rel).replace(os.sep, "/")
        return spec.match_file(rel_str)

    return is_ignored


def iter_files(root: Path, extra_excludes: Iterable[Path], is_ignored_func) -> Iterable[Tuple[Path, Path]]:
    extra_excludes_resolved = {p.resolve() for p in extra_excludes}

    for dirpath, dirnames, filenames in os.walk(root):
        current_dir = Path(dirpath)

        # mutate dirnames in-place to prune ignored or excluded dirs
        pruned_dirnames: List[str] = []
        for d in dirnames:
            # 始终屏蔽 .git 目录
            if d == ".git":
                continue
            full_dir = current_dir / d
            if full_dir.resolve() in extra_excludes_resolved:
                continue
            if is_ignored_func is not None and is_ignored_func(full_dir):
                continue
            pruned_dirnames.append(d)
        dirnames[:] = pruned_dirnames

        for f in filenames:
            full_path = current_dir / f
            if full_path.resolve() in extra_excludes_resolved:
                continue
            if is_ignored_func is not None and is_ignored_func(full_path):
                continue
            rel_path = full_path.relative_to(root)
            yield full_path, rel_path


def ensure_remote_dir(ftp: ftplib.FTP, remote_dir: str) -> None:
    parts = [p for p in remote_dir.split("/") if p]
    path = ""
    for part in parts:
        path = f"{path}/{part}"
        try:
            ftp.mkd(path)
        except ftplib.error_perm as e:
            # ignore "directory already exists"
            if not str(e).startswith("550"):
                raise


def upload_project(
    host: str,
    port: int,
    user: str,
    password: str,
    remote_dir: str,
    project_root: Path,
    gitignore_path: Optional[Path],
) -> int:
    logger.info("Connecting to FTP %s:%s as %s", host, port, user)
    ftp = ftplib.FTP()
    try:
        ftp.connect(host, port)
        ftp.login(user, password)
    except Exception as e:
        logger.error(
            "Failed to connect/login to FTP %s:%s as %s: %s",
            host,
            port,
            user,
            e,
        )
        # return non-zero so外层可以据此判断失败，而不是抛出 traceback
        return 1

    try:
        ensure_remote_dir(ftp, remote_dir)
        ftp.cwd(remote_dir)

        is_ignored_func = load_gitignore_spec(gitignore_path, project_root)

        script_path = Path(__file__).resolve()
        extra_excludes = [script_path]

        # 先收集所有待处理文件，用于进度统计
        all_files: List[Tuple[Path, Path]] = list(
            iter_files(project_root, extra_excludes, is_ignored_func)
        )
        total_files = len(all_files)

        uploaded = 0
        failed = 0
        skipped = 0
        last_progress_len = 0

        def print_progress(message: str) -> None:
            nonlocal last_progress_len
            line = "\r" + message
            padding = max(0, last_progress_len - len(message))
            sys.stdout.write(line + " " * padding)
            sys.stdout.flush()
            last_progress_len = len(message)

        for index, (full_path, rel_path) in enumerate(all_files, start=1):
            percent = (index / total_files * 100) if total_files else 100.0
            progress_prefix = f"[{index}/{total_files} {percent:5.1f}%]"

            remote_file_dir = str((Path(remote_dir) / rel_path.parent).as_posix())
            if remote_file_dir != remote_dir:
                ensure_remote_dir(ftp, remote_file_dir)
            remote_path = str((Path(remote_dir) / rel_path).as_posix())

            # 更新模式：如果远端已有同名文件且大小与本地一致，则跳过
            try:
                local_size = full_path.stat().st_size
            except OSError as e:
                # 单行进度条 + 错误日志
                print_progress(f"{progress_prefix} Error stat {rel_path.as_posix()}: {e}")
                logger.error("Failed to stat local file %s: %s", rel_path.as_posix(), e)
                failed += 1
                continue

            try:
                remote_size = ftp.size(remote_path)
            except ftplib.error_perm:
                remote_size = None
            except Exception as e:  # pragma: no cover
                print_progress(
                    f"{progress_prefix} Warning size {rel_path.as_posix()}: {e}",
                )
                logger.warning(
                    "Failed to get remote size for %s: %s; will try to upload anyway",
                    remote_path,
                    e,
                )
                remote_size = None

            if remote_size is not None and int(remote_size) == int(local_size):
                # 相同大小，视为已同步，更新进度条但不额外打印日志
                print_progress(
                    f"{progress_prefix} Skipping {rel_path.as_posix()} (same size, {local_size} bytes)",
                )
                skipped += 1
                continue

            print_progress(
                f"{progress_prefix} Uploading {rel_path.as_posix()} -> {remote_path}",
            )
            try:
                with open(full_path, "rb") as f:
                    ftp.storbinary(f"STOR {remote_path}", f)
                uploaded += 1
            except Exception as e:  # pragma: no cover - best effort
                print_progress(
                    f"{progress_prefix} Failed {rel_path.as_posix()}: {e}",
                )
                logger.error("Failed to upload %s: %s", rel_path.as_posix(), e)
                failed += 1
        # 最后一条进度输出后换行，避免影响后续输出
        if total_files:
            print()

        logger.info("Upload finished. Uploaded=%s, Skipped=%s, Failed=%s", uploaded, skipped, failed)
        return 0 if failed == 0 else 1
    finally:
        try:
            ftp.quit()
        except Exception:  # pragma: no cover
            ftp.close()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    args = parse_args()
    try:
        host, port, user, password, remote_dir, project_root, gitignore_path = resolve_config(args)
    except SystemExit as e:
        logger.error(str(e))
        raise

    logger.info("Project root: %s", project_root)
    if gitignore_path:
        logger.info(".gitignore used from: %s", gitignore_path)
    else:
        logger.info("No .gitignore found; no gitignore-based filtering will be applied.")

    exit_code = upload_project(
        host=host,
        port=port,
        user=user,
        password=password,
        remote_dir=remote_dir,
        project_root=project_root,
        gitignore_path=gitignore_path,
    )
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()

