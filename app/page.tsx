export default function HomePage() {
  return (
    <main className="w-full max-w-md space-y-6 rounded-xl bg-slate-900/60 p-8 shadow-xl shadow-slate-900/40 backdrop-blur">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
        UniID 统一认证服务
      </h1>
      <p className="text-sm text-slate-300">
        当前为基础框架初始化阶段。稍后将提供登录入口与受保护的控制台页面。
      </p>
      <div className="text-sm text-slate-400">
        <p>请前往 /login 体验登录功能（实现完成后生效）。</p>
      </div>
    </main>
  );
}

