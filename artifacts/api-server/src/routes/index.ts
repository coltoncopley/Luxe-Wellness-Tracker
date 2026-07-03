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
import missionsRouter from "./missions";
import photosRouter from "./photos";
import storageRouter from "./storage";
import referralsRouter from "./referrals";
import socialRouter from "./social";
import meRouter from "./me";
import adminRouter from "./admin";
import billingRouter from "./billing";
import { requireAuth, requireStaff, requirePatient } from "../middlewares/auth";
import { requireActiveSubscription } from "../middlewares/subscription";

const router: IRouter = Router();

// Public: health, service/staff catalog, wellness tips (dashboard summary is authed inside)
router.use(healthRouter);
router.use(catalogRouter);
router.use(wellnessRouter);

// Authenticated, no membership required: profile + billing itself
router.use(requireAuth, meRouter);
router.use(requireAuth, billingRouter);

// Premium patient features: require an active (or trialing) membership
router.use(requireAuth, requireActiveSubscription, appointmentsRouter);
router.use(requireAuth, requireActiveSubscription, trackingRouter);
router.use(requireAuth, requireActiveSubscription, foodRouter);
router.use(requireAuth, requireActiveSubscription, openaiRouter);
router.use(requireAuth, requireActiveSubscription, glowRouter);
router.use(requireAuth, requireActiveSubscription, briefingRouter);
router.use(requireAuth, requireActiveSubscription, rewardsRouter);
router.use(requireAuth, requireActiveSubscription, missionsRouter);
router.use(requireAuth, requireActiveSubscription, photosRouter);
router.use(requireAuth, requireActiveSubscription, storageRouter);
router.use(requireAuth, requireActiveSubscription, referralsRouter);
router.use(requireAuth, requireActiveSubscription, requirePatient, socialRouter);

// Staff-only management routes
router.use(requireAuth, requireStaff, adminRouter);

export default router;
