export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Xolobit Cash Control
        </h1>
      </div>

      <div className="text-sm text-slate-500">
        Usuario
      </div>
    </header>
  );
}