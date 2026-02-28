// models/Customer.js
import mongoose from "mongoose";

const CustomerSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true },
    whatsapp: { type: String, required: true, unique: true }, // só números
    email: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.Customer || mongoose.model("Customer", CustomerSchema);