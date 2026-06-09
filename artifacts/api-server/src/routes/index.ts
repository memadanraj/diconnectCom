import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import tenantsRouter from "./tenants";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import ordersRouter from "./orders";
import dashboardRouter from "./dashboard";
import warehousesRouter from "./warehouses";
import inventoryRouter from "./inventory";
import customersRouter from "./customers";
import shipmentsRouter from "./shipments";
import discountsRouter from "./discounts";
import returnsRouter from "./returns";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/tenants", tenantsRouter);
router.use("/categories", categoriesRouter);
router.use("/products", productsRouter);
router.use("/orders", ordersRouter);
router.use("/dashboard", dashboardRouter);
router.use("/warehouses", warehousesRouter);
router.use("/inventory", inventoryRouter);
router.use("/customers", customersRouter);
router.use("/shipments", shipmentsRouter);
router.use("/discounts", discountsRouter);
router.use("/returns", returnsRouter);

export default router;
