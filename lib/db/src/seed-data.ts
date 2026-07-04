import { sql } from "drizzle-orm";
import { db } from "./index";
import {
  servicesTable,
  staffTable,
  restaurantsTable,
  menuItemsTable,
  tipsTable,
  appSettingsTable,
  rewardItemsTable,
} from "./schema";

const BOOKING_URL = "https://hklqy.myaestheticrecord.com/online-booking";

type LogFn = (message: string) => void;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Session-scoped advisory lock key for the core data seed. */
const SEED_LOCK_KEY = 84291001;

async function seedSettingsAndRewards(tx: Tx, log: LogFn) {
  await tx
    .insert(appSettingsTable)
    .values({ key: "staff_access_code", value: "LW45680" })
    .onConflictDoNothing();

  await tx
    .insert(appSettingsTable)
    .values({ key: "admin_bootstrap_email", value: "coltoncopley@gmail.com" })
    .onConflictDoNothing();

  const existingRewards = await tx.select().from(rewardItemsTable).limit(1);
  if (existingRewards.length === 0) {
    await tx.insert(rewardItemsTable).values([
      { title: "Free B12 Energy Shot", description: "A complimentary B12 injection at your next visit", points: 400, active: true, sortOrder: 1 },
      { title: "$10 Off Any Service", description: "Take $10 off any treatment or service", points: 500, active: true, sortOrder: 2 },
      { title: "Free Dermaplaning Add-On", description: "Add dermaplaning to any facial, on us", points: 800, active: true, sortOrder: 3 },
      { title: "$25 Off Botox or Filler", description: "$25 off your next injectable appointment", points: 1200, active: true, sortOrder: 4 },
    ]);
    log("Seeded reward catalog.");
  }
}

type MenuItemSeed = {
  name: string;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  isHealthyPick: boolean;
  orderingTip: string | null;
};

const RESTAURANT_SEED: {
  name: string;
  cuisine: string;
  description: string;
  items: MenuItemSeed[];
}[] = [
  {
    name: "Chipotle", cuisine: "Mexican", description: "Build-your-own bowls, burritos, and salads.",
    items: [
      { name: "Chicken Salad Bowl (no rice, light cheese)", calories: 405, proteinG: 45, carbsG: 15, fatG: 18, isHealthyPick: true, orderingTip: "Skip the rice and tortilla; double fajita veggies and use salsa instead of dressing." },
      { name: "Chicken Burrito Bowl (white rice, black beans)", calories: 665, proteinG: 45, carbsG: 70, fatG: 20, isHealthyPick: false, orderingTip: null },
      { name: "Steak Bowl (half rice, veggies)", calories: 545, proteinG: 35, carbsG: 45, fatG: 22, isHealthyPick: true, orderingTip: "Ask for half rice and extra veggies to cut ~100 calories." },
      { name: "Chicken Burrito (full)", calories: 1050, proteinG: 50, carbsG: 105, fatG: 40, isHealthyPick: false, orderingTip: null },
    ],
  },
  {
    name: "Chick-fil-A", cuisine: "American", description: "Chicken sandwiches, nuggets, and salads.",
    items: [
      { name: "Grilled Chicken Sandwich", calories: 390, proteinG: 28, carbsG: 44, fatG: 12, isHealthyPick: true, orderingTip: "Grilled instead of fried saves ~150 calories." },
      { name: "Grilled Nuggets (12 ct)", calories: 200, proteinG: 38, carbsG: 2, fatG: 5, isHealthyPick: true, orderingTip: "One of the best protein-per-calorie picks anywhere. Pair with a side salad." },
      { name: "Market Salad with Grilled Chicken", calories: 540, proteinG: 28, carbsG: 41, fatG: 31, isHealthyPick: true, orderingTip: "Use half the dressing packet to save ~120 calories." },
      { name: "Chick-fil-A Deluxe Sandwich", calories: 490, proteinG: 29, carbsG: 43, fatG: 22, isHealthyPick: false, orderingTip: null },
      { name: "Waffle Fries (medium)", calories: 420, proteinG: 5, carbsG: 45, fatG: 24, isHealthyPick: false, orderingTip: null },
    ],
  },
  {
    name: "Panera Bread", cuisine: "Bakery Cafe", description: "Soups, salads, sandwiches, and bowls.",
    items: [
      { name: "Mediterranean Bowl with Chicken", calories: 590, proteinG: 33, carbsG: 55, fatG: 27, isHealthyPick: true, orderingTip: "High fiber and protein; ask for light feta to trim calories." },
      { name: "Turkey Sandwich (half) + Garden Salad", calories: 420, proteinG: 22, carbsG: 40, fatG: 18, isHealthyPick: true, orderingTip: "The half-sandwich combo keeps portions in check." },
      { name: "Broccoli Cheddar Soup (bowl) in Bread Bowl", calories: 900, proteinG: 25, carbsG: 110, fatG: 38, isHealthyPick: false, orderingTip: null },
      { name: "Fuji Apple Salad with Chicken", calories: 550, proteinG: 30, carbsG: 38, fatG: 31, isHealthyPick: true, orderingTip: "Dressing on the side; dip your fork instead of pouring." },
    ],
  },
  {
    name: "Subway", cuisine: "Sandwiches", description: "Custom subs, wraps, and salads.",
    items: [
      { name: "6\" Turkey Breast on Wheat (veggies, no cheese)", calories: 280, proteinG: 18, carbsG: 45, fatG: 4, isHealthyPick: true, orderingTip: "Skip cheese and mayo; use mustard or vinegar for flavor." },
      { name: "Rotisserie Chicken Protein Bowl", calories: 350, proteinG: 39, carbsG: 12, fatG: 16, isHealthyPick: true, orderingTip: "Any footlong can become a lower-carb protein bowl." },
      { name: "Footlong Spicy Italian", calories: 960, proteinG: 40, carbsG: 92, fatG: 48, isHealthyPick: false, orderingTip: null },
    ],
  },
  {
    name: "Olive Garden", cuisine: "Italian", description: "Pasta, soups, and salads.",
    items: [
      { name: "Herb-Grilled Salmon with Broccoli", calories: 460, proteinG: 43, carbsG: 8, fatG: 28, isHealthyPick: true, orderingTip: "The best entree on the menu for protein and omega-3s." },
      { name: "Grilled Chicken Margherita", calories: 540, proteinG: 62, carbsG: 10, fatG: 28, isHealthyPick: true, orderingTip: "Skip the breadsticks or limit to one — each is 140 calories." },
      { name: "Chicken Alfredo", calories: 1310, proteinG: 56, carbsG: 96, fatG: 80, isHealthyPick: false, orderingTip: null },
      { name: "Minestrone Soup + Side Salad (light dressing)", calories: 260, proteinG: 8, carbsG: 40, fatG: 8, isHealthyPick: true, orderingTip: "Unlimited soup and salad can be a smart choice — go minestrone, light dressing, one breadstick max." },
    ],
  },
  {
    name: "Texas Roadhouse", cuisine: "Steakhouse", description: "Steaks, grilled chicken, and sides.",
    items: [
      { name: "6 oz Sirloin with Steamed Vegetables", calories: 430, proteinG: 45, carbsG: 12, fatG: 22, isHealthyPick: true, orderingTip: "Ask for no butter on the steak and veggies to save ~150 calories." },
      { name: "Grilled Chicken Salad (dressing on side)", calories: 480, proteinG: 40, carbsG: 20, fatG: 26, isHealthyPick: true, orderingTip: "Skip the buttery rolls — each with cinnamon butter is ~230 calories." },
      { name: "Country Fried Chicken with Gravy", calories: 990, proteinG: 45, carbsG: 75, fatG: 55, isHealthyPick: false, orderingTip: null },
    ],
  },
  {
    name: "McDonald's", cuisine: "Fast Food", description: "Burgers, chicken, salads, and breakfast.",
    items: [
      { name: "Hamburger + Apple Slices", calories: 265, proteinG: 13, carbsG: 35, fatG: 9, isHealthyPick: true, orderingTip: "The classic hamburger is one of the most calorie-controlled items on the menu." },
      { name: "Egg McMuffin", calories: 310, proteinG: 17, carbsG: 30, fatG: 13, isHealthyPick: true, orderingTip: "One of the best fast-food breakfasts — balanced protein and portion size." },
      { name: "Big Mac Meal (medium)", calories: 1100, proteinG: 34, carbsG: 130, fatG: 48, isHealthyPick: false, orderingTip: null },
    ],
  },
  {
    name: "Wendy's", cuisine: "Fast Food", description: "Burgers, chicken, chili, and salads.",
    items: [
      { name: "Grilled Chicken Sandwich", calories: 350, proteinG: 33, carbsG: 37, fatG: 9, isHealthyPick: true, orderingTip: "Ask for no honey mustard to drop another 60 calories." },
      { name: "Small Chili", calories: 240, proteinG: 16, carbsG: 22, fatG: 10, isHealthyPick: true, orderingTip: "High-protein, high-fiber, and filling — great with a side salad." },
      { name: "Baconator", calories: 960, proteinG: 58, carbsG: 39, fatG: 66, isHealthyPick: false, orderingTip: null },
    ],
  },
  {
    name: "Bob Evans", cuisine: "American", description: "Homestyle breakfast, lunch, and dinner.",
    items: [
      { name: "Fit from the Farm Breakfast (egg whites, fruit, turkey sausage)", calories: 390, proteinG: 28, carbsG: 40, fatG: 12, isHealthyPick: true, orderingTip: "Ask for egg whites and fruit instead of hash browns." },
      { name: "Grilled Chicken Dinner with Green Beans", calories: 450, proteinG: 42, carbsG: 20, fatG: 20, isHealthyPick: true, orderingTip: "Choose two vegetable sides instead of mashed potatoes and rolls." },
      { name: "Rise & Shine Breakfast", calories: 870, proteinG: 30, carbsG: 65, fatG: 52, isHealthyPick: false, orderingTip: null },
    ],
  },
  {
    name: "Cracker Barrel", cuisine: "Southern", description: "Country cooking and homestyle favorites.",
    items: [
      { name: "Grilled Chicken Tenders with Turnip Greens", calories: 380, proteinG: 40, carbsG: 15, fatG: 16, isHealthyPick: true, orderingTip: "Swap biscuits for a side of fresh fruit." },
      { name: "Lemon Pepper Trout with Green Beans", calories: 420, proteinG: 38, carbsG: 10, fatG: 24, isHealthyPick: true, orderingTip: "One of the lightest dinners on the menu — skip the cornbread." },
      { name: "Chicken Fried Chicken with Gravy", calories: 1000, proteinG: 48, carbsG: 80, fatG: 54, isHealthyPick: false, orderingTip: null },
    ],
  },
  {
    name: "Applebee's", cuisine: "American Grill", description: "Grill and bar classics, steaks, and salads.",
    items: [
      { name: "6 oz Top Sirloin with Broccoli", calories: 400, proteinG: 42, carbsG: 12, fatG: 20, isHealthyPick: true, orderingTip: "Ask for double broccoli instead of the potato side." },
      { name: "Grilled Chicken Breast with Veggies", calories: 430, proteinG: 44, carbsG: 18, fatG: 18, isHealthyPick: true, orderingTip: "From the 'Lighter Fare' menu — one of the leanest plates here." },
      { name: "Fiesta Lime Chicken", calories: 1140, proteinG: 51, carbsG: 88, fatG: 62, isHealthyPick: false, orderingTip: null },
      { name: "Riblets Platter", calories: 1250, proteinG: 60, carbsG: 95, fatG: 68, isHealthyPick: false, orderingTip: null },
    ],
  },
  {
    name: "Buffalo Wild Wings", cuisine: "Wings & Sports Bar", description: "Wings, burgers, and shareables.",
    items: [
      { name: "Traditional Wings (6 ct, dry rub)", calories: 430, proteinG: 42, carbsG: 2, fatG: 28, isHealthyPick: true, orderingTip: "Traditional beats boneless — no breading. Pick a dry rub over sauce to skip ~100 calories." },
      { name: "Naked Chicken Tenders with Side Salad", calories: 380, proteinG: 45, carbsG: 12, fatG: 16, isHealthyPick: true, orderingTip: "Ask for grilled 'naked' tenders and dressing on the side." },
      { name: "Boneless Wings (10 ct, honey BBQ)", calories: 860, proteinG: 46, carbsG: 78, fatG: 40, isHealthyPick: false, orderingTip: null },
      { name: "Cheese Curds", calories: 940, proteinG: 28, carbsG: 70, fatG: 60, isHealthyPick: false, orderingTip: null },
    ],
  },
  {
    name: "Panda Express", cuisine: "Chinese", description: "American Chinese classics and build-your-own plates.",
    items: [
      { name: "String Bean Chicken Breast + Super Greens", calories: 300, proteinG: 21, carbsG: 22, fatG: 12, isHealthyPick: true, orderingTip: "Swap rice for super greens to save ~300 calories." },
      { name: "Grilled Teriyaki Chicken + Super Greens", calories: 405, proteinG: 40, carbsG: 22, fatG: 17, isHealthyPick: true, orderingTip: "One of the highest-protein plates — ask for sauce on the side." },
      { name: "Orange Chicken with Fried Rice", calories: 1010, proteinG: 30, carbsG: 125, fatG: 42, isHealthyPick: false, orderingTip: null },
      { name: "Beijing Beef", calories: 690, proteinG: 26, carbsG: 57, fatG: 40, isHealthyPick: false, orderingTip: null },
    ],
  },
  {
    name: "Taco Bell", cuisine: "Mexican Fast Food", description: "Tacos, burritos, and bowls.",
    items: [
      { name: "Chicken Soft Taco (Fresco Style), 2 ct", calories: 300, proteinG: 24, carbsG: 36, fatG: 7, isHealthyPick: true, orderingTip: "Say 'Fresco style' — swaps cheese and sauce for pico de gallo." },
      { name: "Power Menu Bowl with Chicken", calories: 470, proteinG: 26, carbsG: 41, fatG: 21, isHealthyPick: true, orderingTip: "Skip the rice for a lower-carb bowl around 360 calories." },
      { name: "Crunchwrap Supreme", calories: 530, proteinG: 16, carbsG: 71, fatG: 21, isHealthyPick: false, orderingTip: null },
      { name: "Nachos BellGrande", calories: 740, proteinG: 16, carbsG: 82, fatG: 39, isHealthyPick: false, orderingTip: null },
    ],
  },
  {
    name: "Arby's", cuisine: "Sandwiches", description: "Roast beef, turkey, and market fresh sandwiches.",
    items: [
      { name: "Classic Roast Beef", calories: 360, proteinG: 23, carbsG: 37, fatG: 14, isHealthyPick: true, orderingTip: "The classic size keeps portions sensible — skip the cheese sauce." },
      { name: "Roast Turkey Farmhouse Salad", calories: 240, proteinG: 22, carbsG: 12, fatG: 13, isHealthyPick: true, orderingTip: "Light Italian dressing keeps the whole meal under 300 calories." },
      { name: "Half Pound Beef 'N Cheddar", calories: 740, proteinG: 40, carbsG: 47, fatG: 42, isHealthyPick: false, orderingTip: null },
      { name: "Curly Fries (medium)", calories: 550, proteinG: 6, carbsG: 65, fatG: 29, isHealthyPick: false, orderingTip: null },
    ],
  },
  {
    name: "Fazoli's", cuisine: "Italian Fast Food", description: "Fast Italian pasta, subs, and salads.",
    items: [
      { name: "Grilled Chicken Caesar Salad (dressing on side)", calories: 400, proteinG: 33, carbsG: 15, fatG: 24, isHealthyPick: true, orderingTip: "Skip the free breadsticks — each is 150 calories with garlic butter." },
      { name: "Spaghetti with Marinara (small)", calories: 430, proteinG: 14, carbsG: 84, fatG: 4, isHealthyPick: true, orderingTip: "Small marinara is the leanest pasta — add grilled chicken for protein." },
      { name: "Fettuccine Alfredo (regular)", calories: 880, proteinG: 25, carbsG: 115, fatG: 35, isHealthyPick: false, orderingTip: null },
    ],
  },
  {
    name: "Outback Steakhouse", cuisine: "Steakhouse", description: "Steaks, seafood, and Aussie-themed classics.",
    items: [
      { name: "6 oz Victoria's Filet with Broccoli", calories: 450, proteinG: 40, carbsG: 12, fatG: 26, isHealthyPick: true, orderingTip: "Ask for no butter finish; the filet is the leanest cut." },
      { name: "Grilled Chicken on the Barbie with Veggies", calories: 480, proteinG: 48, carbsG: 20, fatG: 22, isHealthyPick: true, orderingTip: "Sauce on the side keeps this under 500 calories." },
      { name: "Bloomin' Onion", calories: 1950, proteinG: 18, carbsG: 123, fatG: 155, isHealthyPick: false, orderingTip: null },
      { name: "Alice Springs Chicken", calories: 940, proteinG: 71, carbsG: 20, fatG: 63, isHealthyPick: false, orderingTip: null },
    ],
  },
  {
    name: "Jimmy John's", cuisine: "Sandwiches", description: "Fast sub sandwiches and unwiches.",
    items: [
      { name: "Turkey Tom Unwich (lettuce wrap)", calories: 250, proteinG: 15, carbsG: 8, fatG: 18, isHealthyPick: true, orderingTip: "Any sub as an 'Unwich' lettuce wrap cuts 250+ calories of bread." },
      { name: "#4 Turkey Tom (8-inch)", calories: 510, proteinG: 24, carbsG: 66, fatG: 17, isHealthyPick: true, orderingTip: "Skip mayo and add extra veggies to bring it near 400 calories." },
      { name: "#9 Italian Night Club", calories: 950, proteinG: 42, carbsG: 71, fatG: 55, isHealthyPick: false, orderingTip: null },
    ],
  },
];

async function seedRestaurants(tx: Tx, log: LogFn) {
  const existing = await tx.select().from(restaurantsTable);
  const rid = new Map(existing.map((r) => [r.name, r.id]));

  const missing = RESTAURANT_SEED.filter((r) => !rid.has(r.name));
  if (missing.length > 0) {
    const inserted = await tx
      .insert(restaurantsTable)
      .values(missing.map(({ name, cuisine, description }) => ({ name, cuisine, description })))
      .returning();
    for (const r of inserted) rid.set(r.name, r.id);
  }

  const existingItems = await tx.select().from(menuItemsTable);
  const itemKeys = new Set(existingItems.map((i) => `${i.restaurantId}:${i.name}`));
  const itemRows = RESTAURANT_SEED.flatMap((r) => {
    const restaurantId = rid.get(r.name);
    if (restaurantId == null) return [];
    return r.items
      .filter((item) => !itemKeys.has(`${restaurantId}:${item.name}`))
      .map((item) => ({ ...item, restaurantId }));
  });
  if (itemRows.length > 0) {
    await tx.insert(menuItemsTable).values(itemRows);
  }

  if (missing.length === 0 && itemRows.length === 0) {
    log("Restaurants already seeded.");
  } else {
    log(`Seeded ${missing.length} restaurants and ${itemRows.length} menu items.`);
  }
}

async function seedServices(tx: Tx, log: LogFn) {
  const existingServices = await tx.select().from(servicesTable).limit(1);
  if (existingServices.length > 0) {
    log("Services already seeded, skipping.");
    return;
  }

  await tx.insert(servicesTable).values([
    { name: "Botox / Neurotoxin", category: "Injectables", description: "Smooth fine lines and wrinkles with expertly placed neurotoxin injections by our medical team.", durationMinutes: 30, priceText: "Consult for pricing", bookingUrl: BOOKING_URL },
    { name: "Dermal Filler", category: "Injectables", description: "Restore volume and enhance contours in lips, cheeks, and jawline with premium dermal fillers.", durationMinutes: 45, priceText: "Consult for pricing", bookingUrl: BOOKING_URL },
    { name: "GLP-1 Weight Loss Program", category: "Weight Loss", description: "Physician-supervised medical weight loss with GLP-1 medications, coaching, and progress monitoring.", durationMinutes: 30, priceText: "Monthly program", bookingUrl: BOOKING_URL },
    { name: "IV Hydration Therapy", category: "Wellness", description: "Replenish vitamins, minerals, and hydration with customized IV drips for energy and recovery.", durationMinutes: 60, priceText: "From $99", bookingUrl: BOOKING_URL },
    { name: "Signature Facial", category: "Skincare", description: "A customized facial by our licensed esthetician to cleanse, exfoliate, and glow.", durationMinutes: 60, priceText: "From $85", bookingUrl: BOOKING_URL },
    { name: "Chemical Peel", category: "Skincare", description: "Medical-grade peels to improve texture, tone, acne, and pigmentation.", durationMinutes: 45, priceText: "Consult for pricing", bookingUrl: BOOKING_URL },
    { name: "Laser Hair Removal", category: "Laser", description: "Long-lasting hair reduction with advanced laser technology for all skin types.", durationMinutes: 30, priceText: "Package pricing", bookingUrl: BOOKING_URL },
    { name: "Full Body Waxing", category: "Waxing", description: "Professional waxing services for smooth, healthy skin from head to toe.", durationMinutes: 30, priceText: "Varies by area", bookingUrl: BOOKING_URL },
    { name: "Microneedling", category: "Skincare", description: "Stimulate collagen production to improve texture, scars, and fine lines.", durationMinutes: 60, priceText: "Consult for pricing", bookingUrl: BOOKING_URL },
    { name: "BHRT Consultation", category: "Wellness", description: "Bioidentical hormone replacement therapy consultation for energy, sleep, and vitality.", durationMinutes: 45, priceText: "Consult for pricing", bookingUrl: BOOKING_URL },
  ]);
  log("Seeded services.");
}

async function seedStaff(tx: Tx, log: LogFn) {
  const existingStaff = await tx.select().from(staffTable).limit(1);
  if (existingStaff.length > 0) {
    log("Staff already seeded, skipping.");
    return;
  }

  await tx.insert(staffTable).values([
    { name: "Dr. Copley", title: "Physician & Medical Director, DO", bio: "Physician-owner of LUXE Wellness and Aesthetics, overseeing all medical treatments and the GLP-1 weight loss program.", photoUrl: "/team/dr-copley.jpg", bookingUrl: BOOKING_URL },
    { name: "Harlee", title: "APRN, Aesthetic Injector", bio: "Advanced practice nurse specializing in neurotoxin and dermal filler treatments with a natural-results philosophy.", photoUrl: "/team/harlee.jpg", bookingUrl: BOOKING_URL },
    { name: "Natalie", title: "Licensed Esthetician", bio: "Skincare specialist offering facials, peels, and personalized skin health plans.", photoUrl: "/team/natalie.jpg", bookingUrl: BOOKING_URL },
    { name: "Bethany", title: "Wax Specialist", bio: "Professional waxing specialist dedicated to comfortable, high-quality smooth-skin services.", photoUrl: "/team/bethany.jpg", bookingUrl: BOOKING_URL },
  ]);
  log("Seeded staff.");
}

async function seedTips(tx: Tx, log: LogFn) {
  const existingTips = await tx.select().from(tipsTable).limit(1);
  if (existingTips.length > 0) {
    log("Tips already seeded, skipping.");
    return;
  }

  await tx.insert(tipsTable).values([
    { category: "nutrition", title: "Protein first", content: "Eat your protein first at every meal. It keeps you fuller longer and preserves muscle during weight loss — aim for 25-30g per meal." },
    { category: "nutrition", title: "Watch liquid calories", content: "Sodas, sweet tea, and fancy coffees can add 300-500 hidden calories a day. Swap for water, sparkling water, or unsweetened tea." },
    { category: "nutrition", title: "The half-plate rule", content: "Fill half your plate with vegetables before adding anything else. You'll naturally eat fewer calories without feeling deprived." },
    { category: "nutrition", title: "Slow down", content: "It takes about 20 minutes for your brain to register fullness. Put your fork down between bites — it helps you notice fullness before you overeat." },
    { category: "weight-loss", title: "Weigh in consistently", content: "Weigh yourself at the same time each day — ideally first thing in the morning. Daily fluctuations of 1-3 lbs are normal water shifts, not fat." },
    { category: "weight-loss", title: "Measure more than weight", content: "Track waist, hips, and arm measurements monthly. You may lose inches even during weeks when the scale doesn't move." },
    { category: "weight-loss", title: "Protect your muscle", content: "Rapid weight loss can burn muscle too. Combine adequate protein (0.7-1g per lb of goal weight) with resistance training 2-3x per week." },
    { category: "weight-loss", title: "Stay hydrated", content: "It's easy to under-drink when you're eating less. Aim for 80+ oz of water daily to avoid fatigue, headaches, and constipation." },
    { category: "skincare", title: "SPF every single day", content: "Daily SPF 30+ is the single best anti-aging treatment. UV damage causes up to 80% of visible skin aging." },
    { category: "skincare", title: "Hydrate from within", content: "Rapid weight loss can leave skin looking deflated. Water, collagen support, and treatments like microneedling can help maintain your glow." },
    { category: "wellness", title: "Sleep is a treatment", content: "7-9 hours of sleep improves skin repair, hunger hormones, and weight loss results. Treat your bedtime like an appointment." },
    { category: "wellness", title: "Walk after meals", content: "A 10-minute walk after eating lowers blood sugar spikes and aids digestion — an easy habit that compounds over time." },
    { category: "dining-out", title: "Scout the menu first", content: "Decide what to order before you arrive at a restaurant. You'll make a calmer, healthier choice than when you're hungry and rushed." },
    { category: "dining-out", title: "Dressing on the side", content: "Restaurant salads can hide 300+ calories in dressing. Order it on the side and dip your fork instead of pouring." },
    { category: "dining-out", title: "Box half immediately", content: "Restaurant portions are often 2-3 servings. Ask for a to-go box when your food arrives and box half before you start." },
  ]);
  log("Seeded tips.");
}

/**
 * Idempotent core data seed: app settings, reward catalog, restaurants,
 * services, staff, and daily tips. Safe to run on every startup.
 *
 * The whole seed runs inside a single transaction guarded by a Postgres
 * transaction-scoped advisory lock, so concurrent starts (e.g. overlapping
 * deploy instances) serialize instead of racing read-then-insert checks, and
 * a mid-seed crash rolls everything back rather than leaving partial data.
 */
export async function seedCoreData(log: LogFn = () => {}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${SEED_LOCK_KEY})`);
    await seedSettingsAndRewards(tx, log);
    await seedRestaurants(tx, log);
    await seedServices(tx, log);
    await seedStaff(tx, log);
    await seedTips(tx, log);
  });
  log("Seed complete.");
}
