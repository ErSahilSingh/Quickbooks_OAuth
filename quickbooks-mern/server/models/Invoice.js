import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    invoiceId: { type: String, required: true, unique: true },
    customerId: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    status: { type: String, default: "" },
    invoiceDate: { type: Date },
    lastUpdated: { type: Date, required: true },
  },
  { timestamps: true, collection: "invoices" }
);

export default mongoose.model("Invoice", invoiceSchema);
