import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0D14] text-white flex flex-col items-center justify-center p-4">
      <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
      <p className="text-neutral-400 mb-6">Could not find requested resource</p>
      <Link
        href="/"
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}
