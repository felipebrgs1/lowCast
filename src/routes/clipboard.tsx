import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useClipboardStore } from "@/stores/clipboardStore";
import { ClipboardItem } from "@/components/ClipboardItem";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/clipboard")({
  component: ClipboardPage,
});

function ClipboardPage() {
  const {
    entries,
    isLoading,
    searchQuery,
    isListening,
    loadHistory,
    search,
    clearHistory,
    startListening,
    stopListening,
  } = useClipboardStore();

  useEffect(() => {
    console.log("[ClipboardPage] Mounting, loading history and starting listener...");
    loadHistory();
    startListening();

    return () => {
      console.log("[ClipboardPage] Unmounting, stopping listener...");
      stopListening();
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Clipboard History</h1>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${isListening ? "bg-green-500" : "bg-red-500"}`}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Limpar
            </Button>
          </div>
        </div>

        <Input
          placeholder="Buscar no histórico..."
          value={searchQuery}
          onChange={(e) => search(e.target.value)}
          className="w-full"
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum item no histórico</p>
              <p className="text-sm">Copie algo para começar</p>
            </div>
          ) : (
            entries.map((entry) => (
              <ClipboardItem key={entry.id} entry={entry} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
