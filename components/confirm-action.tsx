"use client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
export function ConfirmAction({ open, close, title, description, confirm }: { open: boolean; close: () => void; title: string; description: string; confirm: () => void }) {
  return <AlertDialog open={open} onOpenChange={value=>{if(!value)close();}}><AlertDialogContent className="bg-[#fcfcf8] text-[#283c35]"><AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription className="text-[#647166]">{description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="min-h-11">取消，保留原数据</AlertDialogCancel><AlertDialogAction className="min-h-11 bg-[#405a35] text-white" onClick={confirm}>确认{title}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
