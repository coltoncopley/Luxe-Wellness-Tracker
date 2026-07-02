import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import appointmentsRouter from "./appointments";
import trackingRouter from "./tracking";
import foodRouter from "./food";
import wellnessRouter from "./wellness";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(appointmentsRouter);
router.use(trackingRouter);
router.use(foodRouter);
router.use(wellnessRouter);

export default router;
