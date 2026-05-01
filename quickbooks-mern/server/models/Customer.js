import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    lastUpdated: { type: Date, required: true },
  },
  { timestamps: true, collection: "customers" }
);

export default mongoose.model("Customer", customerSchema);
