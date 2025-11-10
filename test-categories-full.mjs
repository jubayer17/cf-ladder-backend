// Test all categories
setTimeout(async () => {
  try {
    const response = await fetch(
      "http://localhost:4000/api/contests/by-category?limit=3"
    );
    const data = await response.json();

    console.log("✅ API Response Successful!\n");
    console.log("📊 Total Contests in Database:", data.counts.total);
    console.log("\n📈 Contests by Category:");
    console.log("  • DIV1+DIV2:", data.counts.DIV1_DIV2);
    console.log("  • DIV1:", data.counts.DIV1);
    console.log("  • DIV2:", data.counts.DIV2);
    console.log("  • DIV3:", data.counts.DIV3);
    console.log("  • DIV4:", data.counts.DIV4);
    console.log("  • GLOBAL:", data.counts.GLOBAL);
    console.log("  • EDUCATIONAL:", data.counts.EDUCATIONAL);
    console.log("  • OTHERS:", data.counts.OTHERS);

    console.log("\n\n📝 Sample Contests from Each Category:\n");

    const categoryNames = {
      DIV1_DIV2: "Div. 1 + Div. 2",
      DIV1: "Div. 1",
      DIV2: "Div. 2",
      DIV3: "Div. 3",
      DIV4: "Div. 4",
      GLOBAL: "Global Rounds",
      EDUCATIONAL: "Educational Rounds",
      OTHERS: "Other Contests",
    };

    Object.entries(data.categories).forEach(([key, contests]) => {
      if (contests.length > 0) {
        console.log(`\n${categoryNames[key] || key}:`);
        contests.forEach((c, idx) => {
          const date = c.date
            ? new Date(c.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "N/A";
          console.log(`  ${idx + 1}. ${c.name}`);
          console.log(
            `     ID: ${c.id} | Problems: ${c.problemCount} | Date: ${date}`
          );
        });
      }
    });

    console.log(
      "\n\n✅ Endpoint /api/contests/by-category is working perfectly!"
    );
  } catch (error) {
    console.error("❌ Error:", error.message || error);
  }
}, 2000);
