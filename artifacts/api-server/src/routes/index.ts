import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import appointmentsRouter from "./appointments";
import trackingRouter from "./tracking";
import foodRouter from "./food";
import wellnessRouter from "./wellness";
import openaiRouter from "./openai";
import glowRouter from "./glow";
import briefingRouter from "./briefing";
import rewardsRouter from "./rewards";
import referralsRouter from "./referrals";
import socialRouter from "./social";
import meRouter from "./me";
import adminRouter from "./admin";
import { requireAuth, requireStaff, requirePatient } from "../middlewares/auth";

const router: IRouter = Router();

// Public: health, service/staff catalog, wellness tips (dashboard summary is authed inside)
router.use(healthRouter);
router.use(catalogRouter);
router.use(wellnessRouter);

// Authenticated patient routes
router.use(requireAuth, meRouter);
router.use(requireAuth, appointmentsRouter);
router.use(requireAuth, trackingRouter);
router.use(requireAuth, foodRouter);
router.use(requireAuth, openaiRouter);
router.use(requireAuth, glowRouter);
router.use(requireAuth, briefingRouter);
router.use(requireAuth, rewardsRouter);
router.use(requireAuth, referralsRouter);
router.use(requireAuth, requirePatient, socialRouter);

// Staff-only management routes
router.use(requireAuth, requireStaff, adminRouter);

export default router;
