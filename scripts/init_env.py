import os
import secrets
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = PROJECT_ROOT / ".env"
ENV_EXAMPLE_PATH = PROJECT_ROOT / ".env.example"


def prompt_with_default(prompt: str, default: str) -> str:
    raw = input(f"{prompt} [{default}]: ").strip()
    return raw or default


def yes_no(prompt: str, default_yes: bool = True) -> bool:
    default = "Y" if default_yes else "N"
    raw = input(f"{prompt} [Y/N] (default {default}): ").strip().lower()
    if not raw:
        return default_yes
    return raw in ("y", "yes")


def generate_secret() -> str:
    # 生成 URL 安全的随机字符串，长度适中
    return secrets.token_urlsafe(32)


def build_env_content(
    auth_jwt_secret: str,
    session_cookie_secret: str,
) -> str:
    lines = [
        f'AUTH_JWT_SECRET="{auth_jwt_secret}"',
        f'SESSION_COOKIE_SECRET="{session_cookie_secret}"',
        "LOG_LEVEL=info",
        "LOG_PRETTY=true",
        "NODE_ENV=development",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    print("=== UniID .env 初始化 ===")
    print(f"项目根目录: {PROJECT_ROOT}")
    print(f"目标 .env 文件: {ENV_PATH}")
    print()

    print("运行期业务配置与功能开关请在 /console/admin/config 中管理。")

    # 1. AUTH_JWT_SECRET
    print()
    use_default_jwt = yes_no("为 AUTH_JWT_SECRET 使用随机生成的安全值？", True)
    if use_default_jwt:
        auth_jwt_secret = generate_secret()
        print("已生成 AUTH_JWT_SECRET。")
    else:
        auth_jwt_secret = prompt_with_default(
            "请输入 AUTH_JWT_SECRET（留空会重新生成随机值）", generate_secret()
        )

    # 2. SESSION_COOKIE_SECRET
    print()
    use_default_session = yes_no("为 SESSION_COOKIE_SECRET 使用随机生成的安全值？", True)
    if use_default_session:
        session_cookie_secret = generate_secret()
        print("已生成 SESSION_COOKIE_SECRET。")
    else:
        session_cookie_secret = prompt_with_default(
            "请输入 SESSION_COOKIE_SECRET（留空会重新生成随机值）", generate_secret()
        )

    # 构造 env 内容
    content = build_env_content(
        auth_jwt_secret=auth_jwt_secret,
        session_cookie_secret=session_cookie_secret,
    )

    print("\n=== 生成的 .env 内容预览 ===\n")
    print(content)

    # 5. 是否写入 .env
    print()
    if ENV_PATH.exists():
        print(f"注意：{ENV_PATH} 已存在。")
        write = yes_no("是否覆盖写入该文件？", False)
    else:
        write = yes_no("是否创建并写入 .env 文件？", True)

    if write:
        ENV_PATH.write_text(content, encoding="utf-8")
        print(f"\n已写入 {ENV_PATH}")
    else:
        print("\n未写入文件，仅在控制台输出 .env 内容。")


if __name__ == "__main__":
    main()

