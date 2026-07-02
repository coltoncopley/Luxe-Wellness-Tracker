import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import appointmentsRouter from "./appointments";
import trackingRouter from "./tracking";
import foodRouter from "./food";
import wellnessRouter from "./wellness";
import openaiRouter from "./openai";
import glowRouter from "./glow";
import rewardsRouter from "./rewards";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(appointmentsRouter);
router.use(trackingRouter);
router.use(foodRouter);
router.use(wellnessRouter);
router.use(openaiRouter);
router.use(glowRouter);
router.use(rewardsRouter);

export default router;
