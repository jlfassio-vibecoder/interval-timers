import React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DeleteProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  programTitle: string;
  isDeleting: boolean;
}

const DeleteProgramModal: React.FC<DeleteProgramModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  programTitle,
  isDeleting,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#120800] shadow-xl"
        >
          <div className="p-6">
            <div className="mb-4 flex items-center gap-4 text-red-500">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Delete Program?</h3>
            </div>

            <p className="mb-6 text-white/70">
              Are you sure you want to delete <strong className="text-white">{programTitle}</strong>
              ? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={isDeleting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-bold text-red-500 transition-colors hover:bg-red-500/20 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Program'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default DeleteProgramModal;
