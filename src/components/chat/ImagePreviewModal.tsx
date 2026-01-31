import { motion, AnimatePresence } from "framer-motion";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImagePreviewModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
}

const ImagePreviewModal = ({
  isOpen,
  imageUrl,
  onClose,
}: ImagePreviewModalProps) => {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md p-4"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative max-w-4xl max-h-[90vh] w-full"
          >
            <div className="absolute -top-12 right-0 flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => window.open(imageUrl, "_blank")}
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="secondary" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <img
              src={imageUrl}
              alt="Preview"
              className="w-full h-full object-contain rounded-lg shadow-2xl"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImagePreviewModal;
