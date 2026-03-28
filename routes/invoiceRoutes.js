import express from "express";
import {
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoice,
} from "../controllers/invoiceController.js";

const router = express.Router();

router.route("/")
  .get(getInvoices)
  .post(createInvoice);

router.route("/:id")
  .get(getInvoiceById)
  .put(updateInvoice)

export default router;
