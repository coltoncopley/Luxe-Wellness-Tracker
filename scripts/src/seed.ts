import { seedCoreData } from "@workspace/db";

seedCoreData((msg) => console.log(msg))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
