import mongoose from "mongoose";

const ReservaSchema = new mongoose.Schema(
  {
    data_evento: { type: String, required: true },
    nome: { type: String, required: true },
    whatsapp: { type: String, required: true },
    email: { type: String },

    horario_inicio: { type: String, default: "09:30" },
    horario_fim: { type: String, default: "22:00" },

    status: {
      type: String,
      enum: ["pendente", "confirmada", "cancelada"],
      default: "pendente",
    },
  },
  { timestamps: true }
);

ReservaSchema.index({ data_evento: 1 }, { unique: true });

export default mongoose.models.Reserva ||
  mongoose.model("Reserva", ReservaSchema);