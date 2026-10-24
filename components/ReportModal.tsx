"use client";

import { useState, useRef } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { useAppStore } from "@/components/AppStoreProvider";
import type { ReportReason } from "@/types";

const defaultReasons: ReportReason[] = [
  "Spam",
  "Fake post",
  "Unsafe",
  "Harassment",
  "Wrong category",
  "Other"
];

type ReportModalProps = {
  open: boolean;
  onClose: () => void;
  itemType: "Post" | "User" | "Business" | "Chat";
  itemId: string;
  itemLabel: string;
  reasons?: ReportReason[];
};

export function ReportModal({
  open,
  onClose,
  itemType,
  itemId,
  itemLabel,
  reasons = defaultReasons
}: ReportModalProps) {
  const { submitReport } = useAppStore();
  const pending=useRef(false);
  const [submitting,setSubmitting]=useState(false);
  const [reason, setReason] = useState<ReportReason>(reasons[0]);

  return (
    <Modal
      description="Choose the closest reason. Your report is securely saved for moderation."
      onClose={onClose}
      open={open}
      title={`Report ${itemType.toLowerCase()}`}
    >
      <div className="space-y-3">
        {reasons.map((item) => (
          <label
            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-100 p-3 transition hover:bg-szocial-mist"
            key={item}
          >
            <input
              checked={reason === item}
              className="h-4 w-4 accent-szocial-orange"
              onChange={() => setReason(item)}
              type="radio"
            />
            <span className="text-sm font-medium text-szocial-ink">{item}</span>
          </label>
        ))}
      </div>
      <Button
        className="mt-5 w-full"
        disabled={submitting}
        onClick={async () => {
          if(pending.current)return;
          pending.current=true;setSubmitting(true);
          try {if (await submitReport(itemType, itemId, itemLabel, reason)) onClose();}
          finally{pending.current=false;setSubmitting(false);}
        }}
      >
        <Flag className="h-4 w-4" />
        Submit report
      </Button>
    </Modal>
  );
}
