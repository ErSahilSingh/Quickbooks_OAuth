import mongoose from "mongoose";


const quickbooksTokenSchema = new mongoose.Schema(
  {
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    companyId: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "QuickbooksTokens" }
);

export default mongoose.model("QuickbooksToken", quickbooksTokenSchema);
