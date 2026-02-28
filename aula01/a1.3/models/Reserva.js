// models/Reserva.js
import mongoose from "mongoose";

const ReservaSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    dataReserva: { type: String, required: true }, // "YYYY-MM-DD"
    horarioInicio: { type: String, default: "09:30" },
    horarioFim: { type: String, default: "22:00" },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
      valorEntrada: { type: Number, default: 0 },
      valorTotal: { type: Number, default: 0 },
      entradaPaga: { type: Boolean, default: false },   // ✅ add
      entradaPagaEm: { type: Date, default: null },     // ✅ add
      observacoes: { type: String, default: "" },
  },
  { timestamps: true }
);

// ✅ Impede 2 reservas ATIVAS no mesmo dia (salão único)
ReservaSchema.index(
  { dataReserva: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["PENDING", "CONFIRMED"] } },
  }
);

export default mongoose.models.Reserva || mongoose.model("Reserva", ReservaSchema);