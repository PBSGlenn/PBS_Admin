// Address Input with Context Menu
import { Input } from "./input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./context-menu";
import { Copy, Clipboard, MapPin } from "lucide-react";
import { invoke } from '@tauri-apps/api/core';

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
  city?: string;
  state?: string;
  postcode?: string;
}

export function AddressInput({
  value,
  onChange,
  className,
  id,
  placeholder,
  city = "",
  state = "",
  postcode = ""
}: AddressInputProps) {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text.trim());
    } catch (error) {
      console.error("Failed to paste:", error);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleCopyFullAddress = async () => {
    try {
      const parts = [value, city, state, postcode].filter(Boolean);
      const fullAddress = parts.join(", ");
      await navigator.clipboard.writeText(fullAddress);
    } catch (error) {
      console.error("Failed to copy full address:", error);
    }
  };

  const handleOpenInGoogleMaps = async () => {
    const parts = [value, city, state, postcode].filter(Boolean);
    const fullAddress = parts.join(", ");

    if (fullAddress) {
      try {
        const encodedAddress = encodeURIComponent(fullAddress);
        const url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
        await invoke("plugin:opener|open_url", { url });
      } catch (error) {
        console.error("Failed to open Google Maps:", error);
      }
    }
  };

  const hasFullAddress = value || city || state || postcode;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
          placeholder={placeholder}
        />
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handlePaste} className="text-[11px]">
          <Clipboard className="mr-2 h-3 w-3" />
          Paste
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopy} className="text-[11px]" disabled={!value}>
          <Copy className="mr-2 h-3 w-3" />
          Copy
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyFullAddress} className="text-[11px]" disabled={!hasFullAddress}>
          <Copy className="mr-2 h-3 w-3" />
          Copy full address
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleOpenInGoogleMaps} className="text-[11px]" disabled={!hasFullAddress}>
          <MapPin className="mr-2 h-3 w-3" />
          Open in Google Maps
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
