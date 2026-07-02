import {
  db,
  servicesTable,
  staffTable,
  restaurantsTable,
  menuItemsTable,
  tipsTable,
} from "@workspace/db";

const BOOKING_URL = "https://hklqy.myaestheticrecord.com/online-booking";

async function seed() {
  const existingServices = await db.select().from(servicesTable).limit(1);
  if (existingServices.length > 0) {
    console.log("Already seeded, skipping.");
    return;
  }

  await db.insert(servicesTable).values([
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

  await db.insert(staffTable).values([
    { name: "Dr. Copley", title: "Physician & Medical Director, DO", bio: "Physician-owner of LUXE Wellness and Aesthetics, overseeing all medical treatments and the GLP-1 weight loss program.", photoUrl: null, bookingUrl: BOOKING_URL },
    { name: "Harlee", title: "APRN, Aesthetic Injector", bio: "Advanced practice nurse specializing in neurotoxin and dermal filler treatments with a natural-results philosophy.", photoUrl: null, bookingUrl: BOOKING_URL },
    { name: "Natalie", title: "Licensed Esthetician", bio: "Skincare specialist offering facials, peels, and personalized skin health plans.", photoUrl: null, bookingUrl: BOOKING_URL },
    { name: "Bethany", title: "Wax Specialist", bio: "Professional waxing specialist dedicated to comfortable, high-quality smooth-skin services.", photoUrl: null, bookingUrl: BOOKING_URL },
  ]);

  const restaurantRows = await db
    .insert(restaurantsTable)
    .values([
      { name: "Chipotle", cuisine: "Mexican", description: "Build-your-own bowls, burritos, and salads." },
      { name: "Chick-fil-A", cuisine: "American", description: "Chicken sandwiches, nuggets, and salads." },
      { name: "Panera Bread", cuisine: "Bakery Cafe", description: "Soups, salads, sandwiches, and bowls." },
      { name: "Subway", cuisine: "Sandwiches", description: "Custom subs, wraps, and salads." },
      { name: "Olive Garden", cuisine: "Italian", description: "Pasta, soups, and salads." },
      { name: "Texas Roadhouse", cuisine: "Steakhouse", description: "Steaks, grilled chicken, and sides." },
      { name: "McDonald's", cuisine: "Fast Food", description: "Burgers, chicken, salads, and breakfast." },
      { name: "Wendy's", cuisine: "Fast Food", description: "Burgers, chicken, chili, and salads." },
      { name: "Bob Evans", cuisine: "American", description: "Homestyle breakfast, lunch, and dinner." },
      { name: "Cracker Barrel", cuisine: "Southern", description: "Country cooking and homestyle favorites." },
    ])
    .returning();

  const rid = new Map(restaurantRows.map((r) => [r.name, r.id]));

  await db.insert(menuItemsTable).values([
    // Chipotle
    { restaurantId: rid.get("Chipotle")!, name: "Chicken Salad Bowl (no rice, light cheese)", calories: 405, proteinG: 45, carbsG: 15, fatG: 18, isHealthyPick: true, orderingTip: "Skip the rice and tortilla; double fajita veggies and use salsa instead of dressing." },
    { restaurantId: rid.get("Chipotle")!, name: "Chicken Burrito Bowl (white rice, black beans)", calories: 665, proteinG: 45, carbsG: 70, fatG: 20, isHealthyPick: false, orderingTip: null },
    { restaurantId: rid.get("Chipotle")!, name: "Steak Bowl (half rice, veggies)", calories: 545, proteinG: 35, carbsG: 45, fatG: 22, isHealthyPick: true, orderingTip: "Ask for half rice and extra veggies to cut ~100 calories." },
    { restaurantId: rid.get("Chipotle")!, name: "Chicken Burrito (full)", calories: 1050, proteinG: 50, carbsG: 105, fatG: 40, isHealthyPick: false, orderingTip: null },
    // Chick-fil-A
    { restaurantId: rid.get("Chick-fil-A")!, name: "Grilled Chicken Sandwich", calories: 390, proteinG: 28, carbsG: 44, fatG: 12, isHealthyPick: true, orderingTip: "Grilled instead of fried saves ~150 calories." },
    { restaurantId: rid.get("Chick-fil-A")!, name: "Grilled Nuggets (12 ct)", calories: 200, proteinG: 38, carbsG: 2, fatG: 5, isHealthyPick: true, orderingTip: "One of the best protein-per-calorie picks anywhere. Pair with a side salad." },
    { restaurantId: rid.get("Chick-fil-A")!, name: "Market Salad with Grilled Chicken", calories: 540, proteinG: 28, carbsG: 41, fatG: 31, isHealthyPick: true, orderingTip: "Use half the dressing packet to save ~120 calories." },
    { restaurantId: rid.get("Chick-fil-A")!, name: "Chick-fil-A Deluxe Sandwich", calories: 490, proteinG: 29, carbsG: 43, fatG: 22, isHealthyPick: false, orderingTip: null },
    { restaurantId: rid.get("Chick-fil-A")!, name: "Waffle Fries (medium)", calories: 420, proteinG: 5, carbsG: 45, fatG: 24, isHealthyPick: false, orderingTip: null },
    // Panera
    { restaurantId: rid.get("Panera Bread")!, name: "Mediterranean Bowl with Chicken", calories: 590, proteinG: 33, carbsG: 55, fatG: 27, isHealthyPick: true, orderingTip: "High fiber and protein; ask for light feta to trim calories." },
    { restaurantId: rid.get("Panera Bread")!, name: "Turkey Sandwich (half) + Garden Salad", calories: 420, proteinG: 22, carbsG: 40, fatG: 18, isHealthyPick: true, orderingTip: "The half-sandwich combo keeps portions in check." },
    { restaurantId: rid.get("Panera Bread")!, name: "Broccoli Cheddar Soup (bowl) in Bread Bowl", calories: 900, proteinG: 25, carbsG: 110, fatG: 38, isHealthyPick: false, orderingTip: null },
    { restaurantId: rid.get("Panera Bread")!, name: "Fuji Apple Salad with Chicken", calories: 550, proteinG: 30, carbsG: 38, fatG: 31, isHealthyPick: true, orderingTip: "Dressing on the side; dip your fork instead of pouring." },
    // Subway
    { restaurantId: rid.get("Subway")!, name: "6\" Turkey Breast on Wheat (veggies, no cheese)", calories: 280, proteinG: 18, carbsG: 45, fatG: 4, isHealthyPick: true, orderingTip: "Skip cheese and mayo; use mustard or vinegar for flavor." },
    { restaurantId: rid.get("Subway")!, name: "Rotisserie Chicken Protein Bowl", calories: 350, proteinG: 39, carbsG: 12, fatG: 16, isHealthyPick: true, orderingTip: "Any footlong can become a lower-carb protein bowl." },
    { restaurantId: rid.get("Subway")!, name: "Footlong Spicy Italian", calories: 960, proteinG: 40, carbsG: 92, fatG: 48, isHealthyPick: false, orderingTip: null },
    // Olive Garden
    { restaurantId: rid.get("Olive Garden")!, name: "Herb-Grilled Salmon with Broccoli", calories: 460, proteinG: 43, carbsG: 8, fatG: 28, isHealthyPick: true, orderingTip: "The best entree on the menu for protein and omega-3s." },
    { restaurantId: rid.get("Olive Garden")!, name: "Grilled Chicken Margherita", calories: 540, proteinG: 62, carbsG: 10, fatG: 28, isHealthyPick: true, orderingTip: "Skip the breadsticks or limit to one — each is 140 calories." },
    { restaurantId: rid.get("Olive Garden")!, name: "Chicken Alfredo", calories: 1310, proteinG: 56, carbsG: 96, fatG: 80, isHealthyPick: false, orderingTip: null },
    { restaurantId: rid.get("Olive Garden")!, name: "Minestrone Soup + Side Salad (light dressing)", calories: 260, proteinG: 8, carbsG: 40, fatG: 8, isHealthyPick: true, orderingTip: "Unlimited soup and salad can be a smart choice — go minestrone, light dressing, one breadstick max." },
    // Texas Roadhouse
    { restaurantId: rid.get("Texas Roadhouse")!, name: "6 oz Sirloin with Steamed Vegetables", calories: 430, proteinG: 45, carbsG: 12, fatG: 22, isHealthyPick: true, orderingTip: "Ask for no butter on the steak and veggies to save ~150 calories." },
    { restaurantId: rid.get("Texas Roadhouse")!, name: "Grilled Chicken Salad (dressing on side)", calories: 480, proteinG: 40, carbsG: 20, fatG: 26, isHealthyPick: true, orderingTip: "Skip the buttery rolls — each with cinnamon butter is ~230 calories." },
    { restaurantId: rid.get("Texas Roadhouse")!, name: "Country Fried Chicken with Gravy", calories: 990, proteinG: 45, carbsG: 75, fatG: 55, isHealthyPick: false, orderingTip: null },
    // McDonald's
    { restaurantId: rid.get("McDonald's")!, name: "Hamburger + Apple Slices", calories: 265, proteinG: 13, carbsG: 35, fatG: 9, isHealthyPick: true, orderingTip: "The classic hamburger is one of the most calorie-controlled items on the menu." },
    { restaurantId: rid.get("McDonald's")!, name: "Egg McMuffin", calories: 310, proteinG: 17, carbsG: 30, fatG: 13, isHealthyPick: true, orderingTip: "One of the best fast-food breakfasts — balanced protein and portion size." },
    { restaurantId: rid.get("McDonald's")!, name: "Big Mac Meal (medium)", calories: 1100, proteinG: 34, carbsG: 130, fatG: 48, isHealthyPick: false, orderingTip: null },
    // Wendy's
    { restaurantId: rid.get("Wendy's")!, name: "Grilled Chicken Sandwich", calories: 350, proteinG: 33, carbsG: 37, fatG: 9, isHealthyPick: true, orderingTip: "Ask for no honey mustard to drop another 60 calories." },
    { restaurantId: rid.get("Wendy's")!, name: "Small Chili", calories: 240, proteinG: 16, carbsG: 22, fatG: 10, isHealthyPick: true, orderingTip: "High-protein, high-fiber, and filling — great with a side salad." },
    { restaurantId: rid.get("Wendy's")!, name: "Baconator", calories: 960, proteinG: 58, carbsG: 39, fatG: 66, isHealthyPick: false, orderingTip: null },
    // Bob Evans
    { restaurantId: rid.get("Bob Evans")!, name: "Fit from the Farm Breakfast (egg whites, fruit, turkey sausage)", calories: 390, proteinG: 28, carbsG: 40, fatG: 12, isHealthyPick: true, orderingTip: "Ask for egg whites and fruit instead of hash browns." },
    { restaurantId: rid.get("Bob Evans")!, name: "Grilled Chicken Dinner with Green Beans", calories: 450, proteinG: 42, carbsG: 20, fatG: 20, isHealthyPick: true, orderingTip: "Choose two vegetable sides instead of mashed potatoes and rolls." },
    { restaurantId: rid.get("Bob Evans")!, name: "Rise & Shine Breakfast", calories: 870, proteinG: 30, carbsG: 65, fatG: 52, isHealthyPick: false, orderingTip: null },
    // Cracker Barrel
    { restaurantId: rid.get("Cracker Barrel")!, name: "Grilled Chicken Tenders with Turnip Greens", calories: 380, proteinG: 40, carbsG: 15, fatG: 16, isHealthyPick: true, orderingTip: "Swap biscuits for a side of fresh fruit." },
    { restaurantId: rid.get("Cracker Barrel")!, name: "Lemon Pepper Trout with Green Beans", calories: 420, proteinG: 38, carbsG: 10, fatG: 24, isHealthyPick: true, orderingTip: "One of the lightest dinners on the menu — skip the cornbread." },
    { restaurantId: rid.get("Cracker Barrel")!, name: "Chicken Fried Chicken with Gravy", calories: 1000, proteinG: 48, carbsG: 80, fatG: 54, isHealthyPick: false, orderingTip: null },
  ]);

  await db.insert(tipsTable).values([
    { category: "nutrition", title: "Protein first", content: "Eat your protein first at every meal. It keeps you fuller longer and preserves muscle during weight loss — aim for 25-30g per meal." },
    { category: "nutrition", title: "Watch liquid calories", content: "Sodas, sweet tea, and fancy coffees can add 300-500 hidden calories a day. Swap for water, sparkling water, or unsweetened tea." },
    { category: "nutrition", title: "The half-plate rule", content: "Fill half your plate with vegetables before adding anything else. You'll naturally eat fewer calories without feeling deprived." },
    { category: "nutrition", title: "Slow down", content: "It takes about 20 minutes for your brain to register fullness. Put your fork down between bites — especially important on GLP-1 medications." },
    { category: "weight-loss", title: "Weigh in consistently", content: "Weigh yourself at the same time each day — ideally first thing in the morning. Daily fluctuations of 1-3 lbs are normal water shifts, not fat." },
    { category: "weight-loss", title: "Measure more than weight", content: "Track waist, hips, and arm measurements monthly. On GLP-1s you may lose inches even during weeks when the scale doesn't move." },
    { category: "weight-loss", title: "Protect your muscle", content: "Rapid weight loss can burn muscle too. Combine adequate protein (0.7-1g per lb of goal weight) with resistance training 2-3x per week." },
    { category: "weight-loss", title: "Stay hydrated on GLP-1s", content: "GLP-1 medications can reduce thirst cues. Aim for 80+ oz of water daily to avoid fatigue, headaches, and constipation." },
    { category: "skincare", title: "SPF every single day", content: "Daily SPF 30+ is the single best anti-aging treatment. UV damage causes up to 80% of visible skin aging." },
    { category: "skincare", title: "Hydrate from within", content: "Rapid weight loss can leave skin looking deflated. Water, collagen support, and treatments like microneedling can help maintain your glow." },
    { category: "wellness", title: "Sleep is a treatment", content: "7-9 hours of sleep improves skin repair, hunger hormones, and weight loss results. Treat your bedtime like an appointment." },
    { category: "wellness", title: "Walk after meals", content: "A 10-minute walk after eating lowers blood sugar spikes and aids digestion — an easy habit that compounds over time." },
    { category: "dining-out", title: "Scout the menu first", content: "Decide what to order before you arrive at a restaurant. You'll make a calmer, healthier choice than when you're hungry and rushed." },
    { category: "dining-out", title: "Dressing on the side", content: "Restaurant salads can hide 300+ calories in dressing. Order it on the side and dip your fork instead of pouring." },
    { category: "dining-out", title: "Box half immediately", content: "Restaurant portions are often 2-3 servings. Ask for a to-go box when your food arrives and box half before you start." },
  ]);

  console.log("Seed complete.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
