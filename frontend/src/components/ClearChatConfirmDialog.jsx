export default function ClearChatConfirmDialog({
  isOpen,
  chatTitle,
  messageCount,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
      <div className="w-[min(90vw,380px)] rounded-lg border border-gray-300 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
            Clear Chat?
          </h2>
        </div>

        <div className="px-4 py-4">
          <p className="text-sm text-gray-700 dark:text-slate-300">
            Are you sure you want to clear all messages in{" "}
            <span className="font-medium text-gray-900 dark:text-slate-100">
              "{chatTitle}"
            </span>
            ?{" "}
            {messageCount > 0 && (
              <span>
                This will delete {messageCount} message
                {messageCount !== 1 ? "s" : ""}.
              </span>
            )}{" "}
            This action cannot be undone.
          </p>
        </div>

        <div className="flex gap-2 border-t border-gray-200 px-4 py-3 dark:border-slate-700">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
