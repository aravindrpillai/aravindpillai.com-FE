 import { useState, useCallback } from "react";
 import { useParams } from "react-router-dom";
 import { motion, AnimatePresence } from "framer-motion";
 import { Trash2, RefreshCw, Upload, X, Play } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import {
   Dialog,
   DialogContent,
   DialogTitle,
 } from "@/components/ui/dialog";
 import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
 
 interface FileItem {
   id: string;
   url: string;
   type: "image" | "video";
   name: string;
 }
 
 const FileGallery = () => {
   const { name, sender } = useParams();
   const [files, setFiles] = useState<FileItem[]>([
     { id: "1", url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400", type: "image", name: "Mountain View" },
     { id: "2", url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400", type: "image", name: "Nature" },
     { id: "3", url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400", type: "image", name: "Lake" },
     { id: "4", url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400", type: "video", name: "Foggy Hills" },
     { id: "5", url: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=400", type: "image", name: "Forest" },
     { id: "6", url: "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=400", type: "image", name: "Waterfall" },
   ]);
   const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
 
   const formatName = (str?: string) => {
     if (!str) return "Gallery";
     return str.charAt(0).toUpperCase() + str.slice(1);
   };
 
   const handleDeleteAll = () => {
     setFiles([]);
   };
 
   const handleRefresh = () => {
     // Simulate refresh
     console.log("Refreshing...");
   };
 
   const handleUpload = useCallback(() => {
     const input = document.createElement("input");
     input.type = "file";
     input.accept = "image/*,video/*";
     input.multiple = true;
     input.onchange = (e) => {
       const target = e.target as HTMLInputElement;
       if (target.files) {
         const newFiles: FileItem[] = Array.from(target.files).map((file, index) => ({
           id: `upload-${Date.now()}-${index}`,
           url: URL.createObjectURL(file),
           type: file.type.startsWith("video") ? "video" : "image",
           name: file.name,
         }));
         setFiles((prev) => [...newFiles, ...prev]);
       }
     };
     input.click();
   }, []);
 
   const handleDeleteFile = (id: string) => {
     setFiles((prev) => prev.filter((f) => f.id !== id));
   };
 
   return (
    <div className="h-dvh bg-background flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col w-full bg-background overflow-hidden">
         {/* Fixed Header */}
        <header className="shrink-0 border-b bg-background/95 backdrop-blur-sm z-40">
           <div className="flex items-center justify-between px-4 py-3">
             <h1 className="text-lg font-semibold text-foreground truncate">
               {formatName(name)}
             </h1>
             <div className="flex items-center gap-1">
               <Button
                 variant="ghost"
                 size="icon"
                 className="h-9 w-9"
                 onClick={handleUpload}
               >
                 <Upload className="w-4 h-4" />
               </Button>
               <Button
                 variant="ghost"
                 size="icon"
                 className="h-9 w-9"
                 onClick={handleRefresh}
               >
                 <RefreshCw className="w-4 h-4" />
               </Button>
               <Button
                 variant="ghost"
                 size="icon"
                 className="h-9 w-9 text-destructive hover:text-destructive"
                 onClick={handleDeleteAll}
               >
                 <Trash2 className="w-4 h-4" />
               </Button>
             </div>
           </div>
         </header>
 
         {/* Scrollable Gallery Area */}
         <main className="flex-1 overflow-y-auto p-4 bg-background">
           {files.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
               <p className="text-sm">No files yet</p>
               <Button
                 variant="outline"
                 className="mt-4"
                 onClick={handleUpload}
               >
                 <Upload className="w-4 h-4 mr-2" />
                 Upload Files
               </Button>
             </div>
           ) : (
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
               <AnimatePresence initial={false}>
                 {files.map((file) => (
                   <GalleryItem
                     key={file.id}
                     file={file}
                     onSelect={() => setSelectedFile(file)}
                     onDelete={() => handleDeleteFile(file.id)}
                   />
                 ))}
               </AnimatePresence>
             </div>
           )}
         </main>
       </div>
 
       {/* Preview Modal */}
       <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
         <DialogContent className="max-w-4xl p-0 bg-background/95 backdrop-blur-md border-0">
           <VisuallyHidden>
             <DialogTitle>{selectedFile?.name || "Preview"}</DialogTitle>
           </VisuallyHidden>
           <div className="relative">
             <Button
               variant="ghost"
               size="icon"
               className="absolute top-2 right-2 z-10 bg-background/50 hover:bg-background/80"
               onClick={() => setSelectedFile(null)}
             >
               <X className="w-4 h-4" />
             </Button>
             {selectedFile?.type === "video" ? (
               <video
                 src={selectedFile.url}
                 controls
                 autoPlay
                 className="w-full max-h-[80vh] rounded-lg"
               />
             ) : (
               <img
                 src={selectedFile?.url}
                 alt={selectedFile?.name}
                 className="w-full max-h-[80vh] object-contain rounded-lg"
               />
             )}
           </div>
         </DialogContent>
       </Dialog>
     </div>
   );
 };
 
 // Gallery item component
 interface GalleryItemProps {
   file: FileItem;
   onSelect: () => void;
   onDelete: () => void;
 }
 
 const GalleryItem = ({ file, onSelect, onDelete }: GalleryItemProps) => {
   return (
     <motion.div
       initial={{ opacity: 0, scale: 0.9 }}
       animate={{ opacity: 1, scale: 1 }}
       exit={{ opacity: 0, scale: 0.9 }}
       className="relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer group"
       onClick={onSelect}
     >
       <img
         src={file.url}
         alt={file.name}
         className="w-full h-full object-cover transition-transform group-hover:scale-105"
       />
       
       {/* Video overlay */}
       {file.type === "video" && (
         <div className="absolute inset-0 flex items-center justify-center bg-black/30">
           <div className="w-12 h-12 rounded-full bg-background/80 flex items-center justify-center">
             <Play className="w-5 h-5 text-foreground ml-0.5" />
           </div>
         </div>
       )}
 
       {/* Hover overlay with delete */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
         <Button
           variant="destructive"
           size="icon"
          className="h-8 w-8"
           onClick={(e) => {
             e.stopPropagation();
             onDelete();
           }}
         >
           <Trash2 className="w-4 h-4" />
         </Button>
       </div>
     </motion.div>
   );
 };
 
 export default FileGallery;