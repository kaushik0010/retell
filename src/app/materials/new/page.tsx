import type { Metadata } from "next";
import { NewMaterialView } from "@/features/materials/NewMaterialView";

export const metadata: Metadata = {
  title: "Add Study Material",
  description:
    "Paste your exam questions and answers to extract important points to remember and prepare your spoken active-recall checklist.",
};

export default function AddMaterialPage() {
  return <NewMaterialView />;
}
