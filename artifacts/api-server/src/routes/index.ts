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
import skinRouter from "./skin";
import ingredientsRouter from "./ingredients";
import passportRouter from "./passport";
import mindRouter from "./mind";
import communityRouter from "./community";
import storageRouter from "./storage";
import referralsRouter from "./referrals";
import socialRouter from "./social";
import announcementsRouter from "./announcements";
import notificationsRouter from "./notifications";
import meRouter from "./me";
import doctorTipsRouter from "./doctorTips";
import offersRouter from "./offers";
import activityRouter from "./activity";
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
router.use(requireAuth, announcementsRouter);
router.use(requireAuth, notificationsRouter);
router.use(requireAuth, doctorTipsRouter);
router.use(requireAuth, offersRouter);

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
router.use(requireAuth, requireActiveSubscription, skinRouter);
router.use(requireAuth, requireActiveSubscription, ingredientsRouter);
// requirePatient must be scoped to the patient-only paths. Mounting it inline
// (e.g. `router.use(requirePatient, passportRouter)`) would run it for EVERY
// request that falls through to that layer — including staff/admin requests
// headed for the admin router below — and reject them with a 403.
//
// Self-tracking routes (passport, mind, activity/sleep/devices) are NOT listed:
// they are strictly user_id-scoped, so staff/admin using them only ever touch
// their OWN data (owner-approved 2026-07). Social/friends/community stay
// patient-only — those can surface data patients shared with other users.
const patientOnlyPaths = [
  "/follows",
  "/friends",
  "/social",
  "/cheers",
  "/community",
];
router.use(patientOnlyPaths, requireAuth, requirePatient);

router.use(requireAuth, requireActiveSubscription, passportRouter);
router.use(requireAuth, requireActiveSubscription, mindRouter);
router.use(requireAuth, requireActiveSubscription, activityRouter);
router.use(requireAuth, requireActiveSubscription, storageRouter);
router.use(requireAuth, requireActiveSubscription, referralsRouter);
router.use(requireAuth, requireActiveSubscription, socialRouter);
router.use(requireAuth, requireActiveSubscription, communityRouter);

// Staff-only management routes
router.use(requireAuth, requireStaff, adminRouter);

export default router;
