import React, { useState } from 'react';
import { BASE } from '../constants';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, PieChart, Pie, CartesianGrid
} from 'recharts';

const Cookbook: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'omnivore' | 'vegetarian' | 'vegan'>('omnivore');
  const [activeMeal, setActiveMeal] = useState<'breakfast' | 'lunch' | 'dinner'>('breakfast');
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [specialModal, setSpecialModal] = useState<{ type: 'macros' | 'why' | 'instructions', recipeId: number } | null>(null);
  
  // Meal Plan State
  const [mealPlan, setMealPlan] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'browse' | 'plan'>('browse');
  
  // Grocery List State
  const [showGroceryList, setShowGroceryList] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Leucine Data
  const leucineData = [
    { name: 'Whey Isolate', val: 3.3 },
    { name: 'Casein', val: 2.9 },
    { name: 'Egg (Whole)', val: 2.6 },
    { name: 'Beef (Sirloin)', val: 2.6 },
    { name: 'Pea Protein', val: 2.4 },
    { name: 'Soy Isolate', val: 2.3 },
    { name: 'Oats', val: 2.1 },
    { name: 'Hemp', val: 1.8 },
    { name: 'Seitan', val: 1.7 }
  ];

  const breakfastRecipes = [
    // --- OMNIVORE ---
    {
        id: 1,
        name: "The High-Voltage Scramble",
        type: "omnivore",
        protein: 34,
        leucine: 2.9,
        time: "8 mins",
        glutenFree: true,
        ingredients: [
            "2 Whole Large Eggs",
            "1/2 cup Liquid Egg Whites (pasteurized)",
            "1 oz Feta Cheese",
            "1 cup Spinach (wilted)"
        ],
        note: "Liquid egg whites are pure albumin. Mixing them with whole eggs keeps the nutrient density high while boosting protein without excessive fat."
    },
    {
        id: 2,
        name: "The Anabolic Steak & Eggs",
        type: "omnivore",
        protein: 38,
        leucine: 3.2,
        time: "12 mins",
        glutenFree: true,
        ingredients: [
            "3.5 oz Lean Flank Steak (leftover or quick sear)",
            "2 Whole Eggs (Sunny side up)",
            "1/2 Avocado (on side)"
        ],
        note: "Red meat is rich in Carnitine and Creatine. Use leftovers to keep prep under 10 minutes."
    },
    {
        id: 3,
        name: "Greek Yogurt Power Bowl",
        type: "omnivore",
        protein: 32,
        leucine: 3.1,
        time: "3 mins",
        glutenFree: true,
        ingredients: [
            "1.5 cups Greek Yogurt (0% or 2%)",
            "1 scoop Collagen Peptides (optional for texture)",
            "1/2 cup Blueberries",
            "1 tbsp Walnuts"
        ],
        note: "Greek yogurt is casein-rich, which gels in the stomach for satiety. It has one of the highest Leucine-to-Calorie ratios."
    },
    {
        id: 4,
        name: "Turkey Sweet Potato Hash",
        type: "omnivore",
        protein: 31,
        leucine: 2.7,
        time: "12 mins",
        glutenFree: true,
        ingredients: [
            "4.5 oz Ground Turkey (93% lean)",
            "1/2 cup Sweet Potato cubes (pre-cooked)",
            "Dash of Paprika & Cumin"
        ],
        note: "Cook a batch of turkey on Sunday. Reheat in a pan with eggs for a savory start."
    },
    {
        id: 5,
        name: "Smoked Salmon Stack",
        type: "omnivore",
        protein: 30,
        leucine: 2.6,
        time: "5 mins",
        ingredients: [
            "3 oz Smoked Salmon",
            "3/4 cup Low-fat Cottage Cheese",
            "1 slice High-Protein Ezekiel Bread",
            "Dill & Capers"
        ],
        note: "Cottage cheese is the secret weapon here—high casein content to complement the fish protein."
    },
    {
        id: 6,
        name: "Chicken Sausage Burrito",
        type: "omnivore",
        protein: 33,
        leucine: 2.8,
        time: "10 mins",
        ingredients: [
            "2 Chicken Sausages (check labels for 12g+ protein each)",
            "1/4 cup Egg Whites",
            "1 Low-Carb/High-Protein Tortilla",
            "Salsa"
        ],
        note: "Processed meats often lack quality protein density—ensure your sausage is meat-first, fillers-last."
    },
    {
        id: 7,
        name: "Pro-Oats (Overnight)",
        type: "omnivore",
        protein: 32,
        leucine: 3.4,
        time: "2 mins (night before)",
        ingredients: [
            "1/2 cup Rolled Oats",
            "1 scoop Whey Protein Isolate (Vanilla)",
            "1/2 cup Milk (Dairy or Ultra-filtered)",
            "Chia Seeds"
        ],
        note: "Whey is essential here. Oats alone have very low leucine. The whey spike triggers the mTOR signal."
    },

    // --- VEGETARIAN ---
    {
        id: 8,
        name: "Cottage Cheese Pancakes",
        type: "vegetarian",
        protein: 35,
        leucine: 3.1,
        time: "12 mins",
        ingredients: [
            "1 cup Cottage Cheese",
            "1/2 cup Oats",
            "2 Eggs",
            "Blend and fry like pancakes"
        ],
        note: "These are shockingly fluffy. The casein in cottage cheese creates a slow-release protein matrix."
    },
    {
        id: 9,
        name: "Egg White Frittata Cups",
        type: "vegetarian",
        protein: 30,
        leucine: 2.6,
        time: "2 mins (Reheat)",
        glutenFree: true,
        ingredients: [
            "1 cup Liquid Egg Whites",
            "1/4 cup Feta Cheese",
            "Spinach & Mushrooms",
            "(Makes 3-4 muffins)"
        ],
        note: "Batch cook 12 of these on Sunday. Feta adds a savory kick and a small protein bump."
    },
    {
        id: 10,
        name: "Halloumi & Bean Shakshuka",
        type: "vegetarian",
        protein: 31,
        leucine: 2.5,
        time: "15 mins",
        glutenFree: true,
        ingredients: [
            "2 Poached Eggs",
            "2 oz Halloumi Cheese (grilled)",
            "1/2 cup Cannellini Beans (in tomato sauce)"
        ],
        note: "Halloumi is lower in leucine per gram, so we anchor it with eggs to ensure the metabolic switch flips."
    },
    {
        id: 11,
        name: "High-Protein French Toast",
        type: "vegetarian",
        protein: 32,
        leucine: 2.9,
        time: "10 mins",
        ingredients: [
            "2 slices High-Protein Bread",
            "Soaked in mix of: 1/2 cup Egg Whites + 1/4 scoop Whey",
            "Cinnamon"
        ],
        note: "Standard French toast is a carb bomb. This version drives protein into the bread like a sponge."
    },
    {
        id: 12,
        name: "Ricotta & Berry Toast",
        type: "vegetarian",
        protein: 30,
        leucine: 2.8,
        time: "4 mins",
        ingredients: [
            "1 cup Part-Skim Ricotta (whipped)",
            "1 scoop Whey Protein (mixed into ricotta)",
            "2 slices Ezekiel Bread",
            "Lemon Zest"
                ],
        note: "Ricotta alone is often too fatty for the protein yield. Fortifying it with whey creates a cheesecake-like texture."
    },
    {
        id: 13,
        name: "Green Machine Smoothie",
        type: "vegetarian",
        protein: 33,
        leucine: 3.5,
        time: "3 mins",
        glutenFree: true,
        ingredients: [
            "1.5 scoops Whey Protein Isolate",
            "1 cup Spinach",
            "1/2 Avocado",
            "Almond Milk"
        ],
        note: "Liquid meals digest faster. Whey Isolate is the fastest absorbing protein, ideal for immediate post-sleep recovery."
    },
    {
        id: 14,
        name: "Lentil Breakfast Bowl",
        type: "vegetarian",
        protein: 31,
        leucine: 2.6,
        time: "8 mins",
        glutenFree: true,
        ingredients: [
            "1 cup Lentils (warm)",
            "2 Soft Boiled Eggs",
            "1 tbsp Hemp Seeds",
            "Hot Sauce"
        ],
        note: "Lentils provide sustained energy, but eggs are the leucine anchor here. Don't skip the yolks."
    },

    // --- VEGAN ---
    {
        id: 15,
        name: "Tofu Scramble Ultra",
        type: "vegan",
        protein: 32,
        leucine: 2.5,
        time: "12 mins",
        glutenFree: true,
        ingredients: [
            "1 block Firm Tofu (pressed, ~200g)",
            "3 tbsp Nutritional Yeast (The Secret Weapon)",
            "1/4 cup Chickpea Flour (mixed with water for batter)",
            "Black Salt (Kala Namak)"
        ],
        note: "Tofu alone struggles to hit 2.5g leucine. Nutritional yeast is non-negotiable here—it adds the savory flavor and the missing amino acids."
    },
    {
        id: 16,
        name: "Pea Protein Acai Bowl",
        type: "vegan",
        protein: 30,
        leucine: 2.7,
        time: "5 mins",
        glutenFree: true,
        ingredients: [
            "1.5 scoops Pea Protein Isolate (Vanilla)",
            "1 Frozen Banana",
            "1 tbsp Almond Butter",
            "Soy Milk Base"
        ],
        note: "Pea protein is the plant kingdom's leucine king. It rivals beef in amino profile. Mask the earthy taste with banana."
    },
    {
        id: 17,
        name: "Tempeh Bacon Hash",
        type: "vegan",
        protein: 31,
        leucine: 2.4, // Borderline
        time: "12 mins",
        glutenFree: true,
        ingredients: [
            "6 oz Tempeh (marinated & fried)",
            "2 tbsp Hemp Hearts (sprinkled on top)",
            "Sautéed Peppers & Onions"
        ],
        note: "Tempeh is fermented, improving digestibility. Hemp hearts are added specifically to push the Leucine over the edge."
    },
    {
        id: 18,
        name: "Seitan 'Chorizo' Tacos",
        type: "vegan",
        protein: 35,
        leucine: 2.6,
        time: "15 mins",
        ingredients: [
            "4 oz Seitan (Wheat Gluten)",
            "1/2 cup Soy Crumbles (TVP)",
            "Corn Tortillas",
            "Avocado Lime Sauce"
        ],
        note: "Seitan is pure protein but lacks Lysine and Leucine. Pairing it with Soy (TVP) creates a complete 'Super-Combo'."
    },
    {
        id: 19,
        name: "Lupin Flour Waffles",
        type: "vegan",
        protein: 30,
        leucine: 2.5,
        time: "12 mins",
        glutenFree: true,
        ingredients: [
            "1/2 cup Lupin Flour",
            "1/4 cup Pea Protein Powder",
            "Almond Milk",
            "Baking Powder"
        ],
        note: "Lupin flour is a legume powerhouse (40% protein). Mixing with pea protein fixes the texture and ensures the leucine hit."
    },
    {
        id: 20,
        name: "Chickpea Omelette (Fortified)",
        type: "vegan",
        protein: 30,
        leucine: 2.5,
        time: "10 mins",
        glutenFree: true,
        ingredients: [
            "3/4 cup Chickpea Flour",
            "1 tbsp Pea Protein Isolate (Unflavored - mixed into dry flour)",
            "Veggies of choice",
            "Nutritional Yeast topping"
        ],
        note: "Chickpea flour is tasty but carb-heavy for the protein yield. The 'invisible' scoop of pea protein fixes the macro ratios."
    },
    {
        id: 21,
        name: "Edamame Quinoa Porridge",
        type: "vegan",
        protein: 31,
        leucine: 2.6,
        time: "10 mins",
        glutenFree: true,
        ingredients: [
            "1 cup Quinoa (cooked)",
            "1 cup Shelled Edamame (steamed)",
            "1 tbsp Pumpkin Seeds",
            "Soy Milk"
                ],
        note: "A savory breakfast common in Asia. Edamame (Soy) and Quinoa are both complete proteins."
    }
  ];

  const lunchRecipes = [
    // --- OMNIVORE LUNCH ---
    {
      id: 22,
      name: "Grilled Chicken Power Bowl",
      type: "omnivore",
      protein: 42,
      leucine: 3.8,
      time: "20 mins",
      glutenFree: true,
      ingredients: [
        "6oz grilled chicken thigh",
        "1 cup brown rice",
        "Roasted broccoli and bell peppers",
        "1 tbsp olive oil",
        "Lemon-tahini drizzle"
      ],
      note: "Carb-loaded for glycogen replenishment. High leucine (~3.4g+) to trigger mTOR post-activity."
    },
    {
      id: 23,
      name: "Steak & Sweet Potato Plate",
      type: "omnivore",
      protein: 38,
      leucine: 3.4,
      time: "25 mins",
      glutenFree: true,
      ingredients: [
        "5oz flank steak (sliced)",
        "1 medium baked sweet potato",
        "Sautéed spinach with garlic",
        "Side of kimchi"
      ],
      note: "Iron-rich. Fermented side supports gut microbiome during eTRE windows."
    },
    {
      id: 24,
      name: "Salmon Niçoise Salad",
      type: "omnivore",
      protein: 44,
      leucine: 4.0,
      time: "15 mins",
      glutenFree: true,
      ingredients: [
        "5oz baked salmon fillet",
        "2 eggs (halved)",
        "Mixed greens, cherry tomatoes, olives",
        "Green beans",
        "Red wine vinaigrette"
      ],
      note: "Ideal Rest Day meal. Low carb, high omega-3s to support anti-inflammatory recovery."
    },
    {
      id: 25,
      name: "Turkey Meatball Lettuce Wraps",
      type: "omnivore",
      protein: 40,
      leucine: 3.6,
      time: "20 mins",
      ingredients: [
        "5 turkey meatballs (ground turkey, oat flour, herbs)",
        "Butter lettuce cups",
        "Pickled red onion",
        "Tzatziki (Greek yogurt base)"
      ],
      note: "High satiety with Greek yogurt in the tzatziki adding slow-digesting casein protein."
    },
    {
      id: 26,
      name: "Chicken Shawarma Bowl",
      type: "omnivore",
      protein: 43,
      leucine: 3.9,
      time: "20 mins",
      glutenFree: true,
      ingredients: [
        "6oz chicken breast (shawarma spiced)",
        "Cauliflower rice",
        "Cucumber-tomato salad",
        "2 tbsp hummus, hot sauce"
      ],
      note: "Cauliflower rice keeps carbs low for rest days. Spices like turmeric are potent anti-inflammatories."
    },
    {
      id: 27,
      name: "Beef & Vegetable Stir-Fry",
      type: "omnivore",
      protein: 36,
      leucine: 3.2,
      time: "15 mins",
      ingredients: [
        "5oz sirloin strips",
        "Mixed stir-fry vegetables (snap peas, carrots, mushrooms)",
        "1 cup jasmine rice",
        "Low-sodium soy sauce, ginger"
      ],
      note: "Fast-digesting carbs for afternoon sessions. Ginger supports digestion efficiency."
    },
    {
      id: 28,
      name: "Tuna Poke Bowl",
      type: "omnivore",
      protein: 42,
      leucine: 3.8,
      time: "10 mins",
      ingredients: [
        "6oz sushi-grade ahi tuna (cubed)",
        "3/4 cup sushi rice",
        "Edamame, avocado slices",
        "Seaweed salad, ponzu"
      ],
      note: "Complete amino acid profile. Edamame adds additional plant protein to the marine source."
    },

    // --- VEGETARIAN ---
    {
      id: 29,
      name: "Greek Protein Power Bowl",
      type: "vegetarian",
      protein: 38,
      leucine: 3.0,
      time: "15 mins",
      glutenFree: true,
      ingredients: [
        "2 eggs (scrambled) + 200g Greek yogurt",
        "Quinoa",
        "Roasted chickpeas, cucumber, cherry tomatoes",
        "Feta, lemon-dill dressing"
      ],
      note: "Eggs + dairy provide complete amino acids and high leucine content (~3.2g)."
    },
    {
      id: 30,
      name: "Lentil & Halloumi Salad",
      type: "vegetarian",
      protein: 36,
      leucine: 2.9,
      time: "20 mins",
      glutenFree: true,
      ingredients: [
        "80g halloumi (grilled)",
        "1 cup cooked green lentils",
        "Roasted red peppers, arugula",
        "Walnuts, balsamic glaze"
      ],
      note: "Halloumi provides dense protein; lentils add essential fiber and iron."
    },
    {
      id: 31,
      name: "Caprese Egg Bake",
      type: "vegetarian",
      protein: 38,
      leucine: 3.0,
      time: "25 mins",
      ingredients: [
        "3-egg frittata with fresh mozzarella",
        "Sun-dried tomatoes, basil",
        "1 slice sourdough",
        "Side salad"
      ],
      note: "Moderate carb. Complete proteins from the egg and dairy combination ensure satiation."
    },
    {
      id: 32,
      name: "Cottage Cheese Stuffed Peppers",
      type: "vegetarian",
      protein: 40,
      leucine: 3.2,
      time: "30 mins",
      glutenFree: true,
      ingredients: [
        "2 bell peppers stuffed with 1 cup cottage cheese",
        "Black beans, corn, cumin",
        "Topped with shredded cheddar, salsa"
      ],
      note: "Cottage cheese is casein-rich, providing sustained amino acid delivery throughout the afternoon."
    },
    {
      id: 33,
      name: "Paneer Tikka Bowl",
      type: "vegetarian",
      protein: 36,
      leucine: 2.9,
      time: "25 mins",
      glutenFree: true,
      ingredients: [
        "150g paneer tikka (grilled)",
        "Basmati rice (3/4 cup)",
        "Sautéed spinach",
        "Raita (yogurt, cucumber, mint)"
      ],
      note: "Paneer provides ~18g protein per 100g with a complete amino acid profile."
    },
    {
      id: 34,
      name: "Mediterranean Egg Wrap",
      type: "vegetarian",
      protein: 34,
      leucine: 2.7,
      time: "15 mins",
      ingredients: [
        "3 eggs (scrambled) + 30g feta",
        "Whole-wheat tortilla",
        "Hummus, roasted zucchini",
        "Sundried tomatoes, olives"
      ],
      note: "Portable option. Whole-wheat wrap adds fiber for eTRE satiety."
    },
    {
      id: 35,
      name: "Tempeh & Egg Fried Rice",
      type: "vegetarian",
      protein: 38,
      leucine: 3.0,
      time: "20 mins",
      ingredients: [
        "100g tempeh (cubed, pan-fried)",
        "2 eggs (scrambled in)",
        "Brown rice, edamame",
        "Bok choy, sesame oil, soy sauce"
      ],
      note: "Tempeh is fermented soy (better bioavailability). Egg rounds out the amino profile."
    },

    // --- VEGAN LUNCH ---
    {
      id: 36,
      name: "Tofu Scramble Power Bowl",
      type: "vegan",
      protein: 38,
      leucine: 2.7,
      time: "20 mins",
      glutenFree: true,
      ingredients: [
        "200g extra-firm tofu (scrambled with turmeric, nutritional yeast)",
        "1 cup black beans",
        "Roasted sweet potato",
        "Avocado, salsa"
      ],
      note: "Soy + beans = complementary amino acids. Nutritional yeast adds B12 and savory depth."
    },
    {
      id: 37,
      name: "Lentil Bolognese over Chickpea Pasta",
      type: "vegan",
      protein: 40,
      leucine: 2.8,
      time: "25 mins",
      glutenFree: true,
      ingredients: [
        "1.5 cups red lentil bolognese (lentils, crushed tomatoes, garlic, basil)",
        "80g chickpea pasta (dry weight)",
        "Nutritional yeast topping"
      ],
      note: "Chickpea pasta alone provides ~25g protein. Lentils add the remaining to hit the threshold."
    },
    {
      id: 38,
      name: "Tempeh Buddha Bowl",
      type: "vegan",
      protein: 36,
      leucine: 2.6,
      time: "25 mins",
      glutenFree: true,
      ingredients: [
        "120g marinated tempeh (grilled)",
        "Quinoa",
        "Roasted Brussels sprouts, shredded red cabbage",
        "Tahini-lemon dressing, hemp seeds"
      ],
      note: "Hemp seeds add 10g protein per 3 tbsp + complete omega profile."
    },
    {
      id: 39,
      name: "Chickpea 'Tuna' Salad Plate",
      type: "vegan",
      protein: 34,
      leucine: 2.5,
      time: "10 mins",
      ingredients: [
        "1.5 cups mashed chickpeas with tahini, lemon, capers, dill, celery",
        "Mixed greens with whole-grain crackers",
        "Side of edamame (1/2 cup)"
      ],
      note: "No-cook option. Chickpea + tahini provides surprisingly complete amino acid coverage."
    },
    {
      id: 40,
      name: "Black Bean & Tofu Burrito Bowl",
      type: "vegan",
      protein: 40,
      leucine: 2.8,
      time: "20 mins",
      glutenFree: true,
      ingredients: [
        "150g firm tofu (seasoned, pan-crisped)",
        "1 cup black beans",
        "Brown rice, corn salsa",
        "Guacamole, lime, hot sauce"
      ],
      note: "Double-plant-protein strategy. Guacamole adds vital monounsaturated fats."
    },
    {
      id: 41,
      name: "Peanut Tempeh Stir-Fry",
      type: "vegan",
      protein: 36,
      leucine: 2.6,
      time: "20 mins",
      ingredients: [
        "120g tempeh (sliced, stir-fried)",
        "Mixed vegetables (broccoli, snap peas, carrots)",
        "Peanut sauce (PB, soy, lime, sriracha)",
        "3/4 cup brown rice"
      ],
      note: "Peanut butter adds leucine density. Tempeh provides complete soy protein."
    },
    {
      id: 42,
      name: "White Bean & Kale Soup",
      type: "vegan",
      protein: 34,
      leucine: 2.5,
      time: "25 mins",
      ingredients: [
        "2 cups Tuscan white bean soup (cannellini beans, kale, tomatoes, garlic, vegetable broth)",
        "2 slices seeded bread with almond butter"
      ],
      note: "Warming, high-fiber option. White beans provide ~17g protein per cup."
    }
  ];

  const dinnerRecipes = [
    // --- OMNIVORE DINNER ---
    {
      id: 43,
      name: "Herb-Crusted Salmon & Greens",
      type: "omnivore",
      protein: 42,
      leucine: 3.5,
      time: "20 mins",
      ingredients: [
        "6oz Atlantic salmon fillet (herb-crusted)",
        "Roasted asparagus",
        "Mixed green salad with olive oil/lemon",
        "1/4 avocado"
      ],
      note: "Rest Day. Omega-3 dominant. Slow-digesting whole-food protein sustains amino acids into the overnight fast."
    },
    {
      id: 44,
      name: "Slow-Cooker Chicken Thigh Stew",
      type: "omnivore",
      protein: 44,
      leucine: 3.8,
      time: "10 mins (Prep)",
      glutenFree: true,
      ingredients: [
        "2 bone-in chicken thighs (skin removed)",
        "Carrots, celery, white beans (1/2 cup)",
        "Garlic, thyme, low-sodium chicken broth",
        "Side of steamed greens"
      ],
      note: "Collagen from bone-in cooking supports joint recovery. White beans add fiber for overnight satiety."
    },
    {
      id: 45,
      name: "Grilled Flank Steak Fajitas",
      type: "omnivore",
      protein: 40,
      leucine: 3.4,
      time: "20 mins",
      glutenFree: true,
      ingredients: [
        "5oz flank steak (sliced)",
        "Sautéed bell peppers and onions",
        "2 small corn tortillas",
        "Pico de gallo, 2 tbsp Greek yogurt"
      ],
      note: "Training Day. Post-Functional-Force recovery meal. Greek yogurt adds casein."
    },
    {
      id: 46,
      name: "Baked Cod with Mediterranean Veg",
      type: "omnivore",
      protein: 38,
      leucine: 3.1,
      time: "25 mins",
      glutenFree: true,
      ingredients: [
        "7oz cod fillet (baked with garlic/capers)",
        "Roasted zucchini and eggplant",
        "Drizzle of extra virgin olive oil",
        "Fresh basil"
      ],
      note: "Lean white fish is highly digestible. Mediterranean fat profile supports overnight anti-inflammatory processes."
    },
    {
      id: 47,
      name: "Turkey Chili Bowl",
      type: "omnivore",
      protein: 46,
      leucine: 3.9,
      time: "30 mins",
      glutenFree: true,
      ingredients: [
        "6oz ground turkey (93% lean)",
        "Kidney beans (1/2 cup), tomatoes, onions",
        "Cumin, chili powder",
        "Topped with cheese (1oz) and cilantro"
      ],
      note: "High-volume, satiating. Beans provide resistant starch. Cheese adds slow-release casein."
    },
    {
      id: 48,
      name: "Lemon-Garlic Shrimp & Cauliflower",
      type: "omnivore",
      protein: 40,
      leucine: 3.3,
      time: "15 mins",
      glutenFree: true,
      ingredients: [
        "8oz shrimp (sautéed in garlic/butter)",
        "Cauliflower mash (steamed + butter)",
        "Steamed broccolini"
      ],
      note: "Very low carb. Cauliflower mash replaces potato to support the overnight metabolic switch to fat oxidation."
    },
    {
      id: 49,
      name: "Pork Tenderloin with Roasted Roots",
      type: "omnivore",
      protein: 38,
      leucine: 3.2,
      time: "25 mins",
      glutenFree: true,
      ingredients: [
        "5oz pork tenderloin (herb-roasted)",
        "Roasted root vegetables (parsnips, carrots - 1 cup)",
        "Sautéed kale with garlic"
      ],
      note: "Lean pork is underutilized — comparable leucine to chicken. Root vegetables provide complex carbs for glycogen."
    },

    // --- VEGETARIAN DINNER ---
    {
      id: 50,
      name: "Shakshuka with Feta & Lentils",
      type: "vegetarian",
      protein: 38,
      leucine: 3.1,
      time: "20 mins",
      ingredients: [
        "3 eggs poached in spiced tomato sauce",
        "1/2 cup green lentils stirred in",
        "50g crumbled feta",
        "1 slice sourdough"
      ],
      note: "Eggs provide complete aminos + leucine. Lentils add fiber and iron."
    },
    {
      id: 51,
      name: "Paneer Saag with Raita",
      type: "vegetarian",
      protein: 36,
      leucine: 3.2,
      time: "25 mins",
      glutenFree: true,
      ingredients: [
        "150g paneer (cubed, pan-seared)",
        "Spinach-based saag (garlic, ginger)",
        "3/4 cup basmati rice",
        "Cucumber raita"
      ],
      note: "Raita adds casein for slow overnight amino acid release."
    },
    {
      id: 52,
      name: "Eggplant Parmesan Stack",
      type: "vegetarian",
      protein: 38,
      leucine: 3.3,
      time: "35 mins",
      ingredients: [
        "Thick-sliced eggplant (breaded, baked)",
        "Marinara sauce",
        "100g fresh mozzarella",
        "2 eggs (whisked into breading)"
      ],
      note: "Mozzarella + egg combination provides excellent amino acid balance and slow digestion."
    },
    {
      id: 53,
      name: "Black Bean & Egg Enchilada Bake",
      type: "vegetarian",
      protein: 36,
      leucine: 2.9,
      time: "30 mins",
      glutenFree: true,
      ingredients: [
        "2 corn tortillas layered with black beans",
        "2 scrambled eggs",
        "Enchilada sauce, 50g Monterey Jack",
        "Avocado slices"
      ],
      note: "Beans + eggs = complete protein. Cheese adds calcium and casein."
    },
    {
      id: 54,
      name: "Mushroom & Ricotta Stuffed Shells",
      type: "vegetarian",
      protein: 34,
      leucine: 3.1,
      time: "35 mins",
      ingredients: [
        "6 large pasta shells",
        "Stuffed with ricotta (150g), mushrooms, spinach",
        "Parmesan (30g)",
        "Baked in marinara"
      ],
      note: "Ricotta is ~80% casein protein, ideal for the final meal before the overnight fast."
    },
    {
      id: 55,
      name: "Thai Coconut Egg Curry",
      type: "vegetarian",
      protein: 38,
      leucine: 3.0,
      time: "20 mins",
      glutenFree: true,
      ingredients: [
        "3 hard-boiled eggs halved",
        "Coconut-peanut curry sauce",
        "100g firm tofu",
        "Cauliflower rice"
      ],
      note: "Low carb. Coconut milk provides MCTs. Egg + tofu double-protein strategy."
    },
    {
      id: 56,
      name: "Grilled Halloumi & Veg Plate",
      type: "vegetarian",
      protein: 34,
      leucine: 2.8,
      time: "15 mins",
      glutenFree: true,
      ingredients: [
        "100g halloumi (grilled)",
        "Roasted sweet potato, peppers, zucchini",
        "2 tbsp hummus",
        "Mixed greens"
      ],
      note: "Hummus adds plant protein and healthy fats for satiety."
    },

    // --- VEGAN DINNER ---
    {
      id: 57,
      name: "Coconut Lentil Dal with Tofu",
      type: "vegan",
      protein: 36,
      leucine: 2.6,
      time: "25 mins",
      glutenFree: true,
      ingredients: [
        "1.5 cups red lentil dal (coconut milk, spices)",
        "100g firm tofu (cubed, pan-crisped)",
        "1/2 cup brown rice",
        "Fresh cilantro"
      ],
      note: "Lentils + tofu = complementary amino acids. Turmeric is anti-inflammatory."
    },
    {
      id: 58,
      name: "Stuffed Peppers with Black Beans",
      type: "vegan",
      protein: 34,
      leucine: 2.5,
      time: "35 mins",
      glutenFree: true,
      ingredients: [
        "2 large bell peppers",
        "Stuffed with black beans (1 cup) & quinoa",
        "Corn, cumin, smoked paprika",
        "Avocado crema topping"
      ],
      note: "Quinoa is a complete plant protein. Black beans add resistant starch for gut health."
    },
    {
      id: 59,
      name: "Peanut Tofu Noodle Bowl",
      type: "vegan",
      protein: 40,
      leucine: 2.9,
      time: "20 mins",
      ingredients: [
        "150g extra-firm tofu (marinated)",
        "Soba noodles (buckwheat)",
        "Edamame (1/2 cup)",
        "Peanut-lime sauce"
      ],
      note: "Triple-protein approach: tofu + edamame + peanut. Soba noodles are higher protein than wheat."
    },
    {
      id: 60,
      name: "Chickpea & Spinach Coconut Curry",
      type: "vegan",
      protein: 32,
      leucine: 2.4,
      time: "25 mins",
      ingredients: [
        "1.5 cups chickpea curry (spinach, tomato)",
        "Coconut milk base",
        "1/2 cup basmati rice",
        "Whole-wheat roti (optional)"
      ],
      note: "Chickpeas are leucine-dense. Pair with hemp seeds if possible for extra protein."
    },
    {
      id: 61,
      name: "Tempeh Steak with Roasted Veg",
      type: "vegan",
      protein: 36,
      leucine: 2.7,
      time: "20 mins",
      glutenFree: true,
      ingredients: [
        "150g tempeh (sliced into 'steaks', grilled)",
        "Roasted Brussels sprouts",
        "Sweet potato wedges",
        "Tahini drizzle"
      ],
      note: "Tempeh’s fermentation increases protein bioavailability. Tahini adds calcium."
    },
    {
      id: 62,
      name: "White Bean Cassoulet",
      type: "vegan",
      protein: 36,
      leucine: 2.7,
      time: "40 mins",
      ingredients: [
        "2 cups cassoulet (cannellini beans)",
        "Plant-based sausage (60g)",
        "Carrots, celery, rosemary",
        "Crusty sourdough"
      ],
      note: "White beans provide slow-digesting protein + resistant starch. Ideal for batch cooking."
    },
    {
      id: 63,
      name: "Miso-Glazed Eggplant & Edamame",
      type: "vegan",
      protein: 34,
      leucine: 2.6,
      time: "30 mins",
      glutenFree: true,
      ingredients: [
        "1 large eggplant (miso-glazed, roasted)",
        "3/4 cup brown rice",
        "1 cup shelled edamame",
        "Pickled ginger, sesame seeds"
      ],
      note: "Edamame provides ~17g protein per cup. Miso supports gut microbiome before overnight fast."
    }
  ];

  const generateRecipeContent = (recipe: any) => ({
    macros: {
        calories: Math.round(recipe.protein * 4 + 200), // Rough estimate: 4kcal/g protein + 200kcal fats/carbs
        protein: `${recipe.protein}g`
    },
    why: {
        title: "Metabolic Mechanism",
        points: [
            `Delivers ${recipe.leucine}g Leucine, exceeding the anabolic threshold.`,
            recipe.type === 'omnivore' ? "High bioavailability protein source." : "Strategic plant-protein pairing for complete amino acid profile.",
            "Optimized for maximum satiety and stable blood glucose."
        ]
    },
    instructions: {
        method: "Preparation",
        steps: [
            "Gather and prep all ingredients listed.",
            "Cook protein component (if required) until done.",
            "Assemble with sides and garnishes.",
            "Consume within the active feeding window."
        ]
    }
  });

  const breakfastContent = breakfastRecipes.reduce((acc, r) => ({...acc, [r.id]: generateRecipeContent(r)}), {} as any);
  const lunchContent = lunchRecipes.reduce((acc, r) => ({...acc, [r.id]: generateRecipeContent(r)}), {} as any);
  const dinnerContent = dinnerRecipes.reduce((acc, r) => ({...acc, [r.id]: generateRecipeContent(r)}), {} as any);

  const currentRecipes = activeMeal === 'breakfast' ? breakfastRecipes : activeMeal === 'lunch' ? lunchRecipes : dinnerRecipes;
  const allRecipes = [...breakfastRecipes, ...lunchRecipes, ...dinnerRecipes];
  
  // Dynamic colors based on meal type
  const theme = {
    color: activeMeal === 'breakfast' ? 'text-sync-orange' : activeMeal === 'lunch' ? 'text-teal-600' : 'text-indigo-500',
    bg: activeMeal === 'breakfast' ? 'bg-sync-orange' : activeMeal === 'lunch' ? 'bg-teal-600' : 'bg-indigo-600',
    hoverBg: activeMeal === 'breakfast' ? 'hover:bg-orange-600' : activeMeal === 'lunch' ? 'hover:bg-teal-700' : 'hover:bg-indigo-700',
    bgLight: activeMeal === 'breakfast' ? 'bg-orange-100' : activeMeal === 'lunch' ? 'bg-teal-50' : 'bg-indigo-50',
    textDark: activeMeal === 'breakfast' ? 'text-orange-800' : activeMeal === 'lunch' ? 'text-teal-800' : 'text-indigo-900',
    border: activeMeal === 'breakfast' ? 'border-sync-orange' : activeMeal === 'lunch' ? 'border-teal-600' : 'border-indigo-600'
  };

  const getSpecialContent = () => {
    if (!specialModal) return null;
    const content = { ...breakfastContent, ...lunchContent, ...dinnerContent }[specialModal.recipeId];
    if (!content) return (
        <div className="text-center p-8">
            <p className="text-gray-500">Detailed breakdown coming soon for this recipe.</p>
        </div>
    );

    switch (specialModal.type) {
      case 'macros':
        return (
          <>
            <h2 className="text-xl font-bold text-indigo-700 mb-4">Macro Breakdown</h2>
            <div className="overflow-x-auto mb-6 border rounded-lg border-gray-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-indigo-50 text-indigo-800 font-bold">
                        <tr><th className="px-4 py-2">Nutrient</th><th className="px-4 py-2">Amount</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        <tr><td className="px-4 py-2 font-bold">Calories</td><td className="px-4 py-2">{content.macros.calories}</td></tr>
                        <tr><td className="px-4 py-2 font-bold">Protein</td><td className="px-4 py-2">{content.macros.protein}</td></tr>
                    </tbody>
                </table>
            </div>
          </>
        );
      case 'why':
        return (
          <>
            <h2 className="text-xl font-bold text-indigo-700 mb-4">{content.why.title}</h2>
            <ul className="list-disc pl-5 space-y-3 text-sm mb-6">
                {content.why.points.map((p: string, i: number) => (
                    <li key={i}>{p}</li>
                ))}
            </ul>
          </>
        );
      case 'instructions':
        return (
          <>
            <h2 className="text-xl font-bold text-indigo-700 mb-4">{content.instructions.method}</h2>
            <ol className="list-decimal pl-5 space-y-4 text-sm mb-8">
                {content.instructions.steps.map((s: string, i: number) => (
                     <li key={i}>{s}</li>
                ))}
            </ol>
          </>
        );
      default:
        return null;
    }
  };

  const toggleRecipe = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setMealPlan(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const getSelectedRecipes = () => {
      return allRecipes.filter(r => mealPlan.includes(r.id));
  };

  const calculateTotalMacros = () => {
      const selected = getSelectedRecipes();
      const totalProtein = selected.reduce((acc, r) => acc + r.protein, 0);
      const totalLeucine = selected.reduce((acc, r) => acc + r.leucine, 0);
      return { protein: totalProtein, leucine: totalLeucine.toFixed(1), count: selected.length };
  };
  
  const getGroceryList = () => {
      const selected = getSelectedRecipes();
      const allIngredients = Array.from(new Set(selected.flatMap(r => r.ingredients))).sort();
      return allIngredients;
  };
  
  const toggleGroceryItem = (item: string) => {
      setCheckedItems(prev => ({
          ...prev,
          [item]: !prev[item]
      }));
  };
  
  const copyToClipboard = () => {
      const list = getGroceryList().map(item => checkedItems[item] ? `[x] ${item}` : `[ ] ${item}`).join('\n');
      navigator.clipboard.writeText(list);
      alert("Grocery list copied to clipboard!");
  };

  const planTotals = calculateTotalMacros();

  // MEAL PLAN VIEW
  if (viewMode === 'plan') {
      const selected = getSelectedRecipes();
      return (
        <div className="bg-sync-base min-h-screen text-sync-dark font-sans animate-fade-in pb-20">
            <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-sync-blue">Sync-60 <span className="text-gray-400 font-normal">| Meal Plan</span></span>
                    </div>
                    <button onClick={() => setViewMode('browse')} className="text-sm font-bold text-gray-500 hover:text-sync-blue transition-colors">
                        ← Back to Recipes
                    </button>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
                <header className="text-center mb-10">
                    <h1 className="text-3xl font-display font-bold text-sync-blue">Your Weekly Architecture</h1>
                    <p className="text-gray-600">Selected anchors for metabolic synchronization.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Summary Card */}
                    <div className="md:col-span-1">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-24">
                            <h3 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Plan Totals</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-500">Recipes Selected</span>
                                    <span className="font-bold text-sync-blue">{planTotals.count}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-500">Total Protein</span>
                                    <span className="font-bold text-sync-orange">{planTotals.protein}g</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-500">Total Leucine</span>
                                    <span className="font-bold text-green-600">{planTotals.leucine}g</span>
                                </div>
                            </div>
                            
                            {/* Consolidated Shopping List Preview / Button */}
                            {selected.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-gray-100">
                                    <button 
                                        onClick={() => setShowGroceryList(true)}
                                        className="w-full mb-3 py-3 bg-sync-blue text-white rounded-xl font-bold text-sm hover:bg-sync-dark transition-colors flex items-center justify-center gap-2 shadow-md"
                                    >
                                        <span>🛒</span>
                                        <span>Open Grocery List</span>
                                    </button>
                                </div>
                            )}

                            <button 
                                onClick={() => window.print()}
                                className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
                            >
                                Print Plan
                            </button>
                        </div>
                    </div>

                    {/* Recipe List */}
                    <div className="md:col-span-2 space-y-4">
                        {selected.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-300">
                                No recipes selected yet. Go back to browse.
                            </div>
                        ) : (
                            selected.map(recipe => (
                                <div key={recipe.id} className="bg-white p-5 rounded-xl border border-gray-200 flex flex-col gap-4 group hover:border-sync-blue transition-colors shadow-sm">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex gap-2 items-center mb-1">
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{recipe.type}</span>
                                                <span className="text-gray-300">•</span>
                                                <span className="text-xs font-medium text-gray-500">{recipe.time}</span>
                                                {recipe.glutenFree && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                                        GF
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="font-bold text-lg text-sync-dark">{recipe.name}</h4>
                                            <div className="flex gap-3 text-xs mt-2 text-gray-500">
                                                <span className="bg-gray-100 px-2 py-1 rounded">Protein: <strong className="text-gray-700">{recipe.protein}g</strong></span>
                                                <span className="bg-gray-100 px-2 py-1 rounded">Leucine: <strong className="text-gray-700">{recipe.leucine}g</strong></span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={(e) => toggleRecipe(recipe.id, e)}
                                            className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Remove from plan"
                                        >
                                            <span className="text-xl">×</span>
                                        </button>
                                    </div>
                                    
                                    <div className="border-t border-gray-100 pt-3">
                                        <h5 className="text-xs font-bold text-sync-blue uppercase tracking-wide mb-2">Ingredients</h5>
                                        <ul className="text-sm text-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                            {recipe.ingredients.map((ing: string, i: number) => (
                                                <li key={i} className="flex items-start gap-2">
                                                    <span className="text-sync-orange mt-1.5 text-[8px]">●</span>
                                                    <span className="leading-tight">{ing}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>
            
            {/* GROCERY LIST MODAL */}
            {showGroceryList && (
                <div className="fixed inset-0 z-[200] bg-white md:bg-black/50 flex md:items-center md:justify-center animate-in fade-in duration-200">
                    <div className="w-full h-full md:h-[80vh] md:w-[600px] bg-white md:rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 bg-white sticky top-0 z-10 flex justify-between items-center shadow-sm">
                            <div>
                                <h3 className="text-2xl font-display font-bold text-sync-blue">Grocery List</h3>
                                <p className="text-xs text-gray-500">{getGroceryList().length} items to shop</p>
                            </div>
                            <button 
                                onClick={() => setShowGroceryList(false)}
                                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        
                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-6 custom-scrollbar">
                            {getGroceryList().length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                                    <span className="text-4xl mb-4">🛒</span>
                                    <p>Your list is empty. Add recipes to your plan first.</p>
                                </div>
                            ) : (
                                <ul className="space-y-2">
                                    {getGroceryList().map((item, idx) => (
                                        <li 
                                            key={idx} 
                                            onClick={() => toggleGroceryItem(item)}
                                            className={`p-4 rounded-xl border flex items-center gap-4 cursor-pointer transition-all ${checkedItems[item] ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200 hover:border-sync-blue'}`}
                                        >
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checkedItems[item] ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                                                {checkedItems[item] && <span className="text-white text-xs font-bold">✓</span>}
                                            </div>
                                            <span className={`text-base font-medium flex-1 ${checkedItems[item] ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                                {item}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        
                        {/* Footer Actions */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 md:rounded-b-2xl sticky bottom-0 z-10 flex gap-3">
                            <button 
                                onClick={copyToClipboard}
                                className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                            >
                                Copy List
                            </button>
                            <button 
                                onClick={() => setShowGroceryList(false)}
                                className="flex-1 py-3 bg-sync-blue text-white font-bold rounded-xl hover:bg-sync-dark transition-colors shadow-md"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      );
  }

  return (
    <div className="bg-sync-base min-h-screen text-sync-dark font-sans animate-fade-in pb-20">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-sync-base/95 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-sync-orange"></div>
             <span className="font-display font-bold text-sync-blue">Sync-60 <span className="text-gray-400 font-normal">| The Cookbook</span></span>
           </div>
           <a href={BASE + '/'} className="text-sm font-bold text-gray-500 hover:text-sync-blue transition-colors">
             ← Back to Home
           </a>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
        
        {/* HERO SECTION */}
        <section className={`rounded-3xl p-8 md:p-16 text-center shadow-lg relative overflow-hidden transition-colors duration-500 ${activeMeal === 'breakfast' ? 'bg-sync-blue text-white' : activeMeal === 'lunch' ? 'bg-teal-900 text-white' : 'bg-indigo-900 text-white'}`}>
            <div className="relative z-10 max-w-4xl mx-auto">
                <div className="inline-flex bg-white/10 backdrop-blur-sm rounded-full p-1 mb-8 border border-white/20">
                    <button 
                        onClick={() => setActiveMeal('breakfast')}
                        className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeMeal === 'breakfast' ? 'bg-white text-sync-blue shadow-lg' : 'text-white/70 hover:text-white'}`}
                    >
                        Breakfast (The Anchor)
                    </button>
                    <button 
                        onClick={() => setActiveMeal('lunch')}
                        className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeMeal === 'lunch' ? 'bg-white text-teal-900 shadow-lg' : 'text-white/70 hover:text-white'}`}
                    >
                        Lunch (Midday)
                    </button>
                    <button 
                        onClick={() => setActiveMeal('dinner')}
                        className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeMeal === 'dinner' ? 'bg-white text-indigo-900 shadow-lg' : 'text-white/70 hover:text-white'}`}
                    >
                        Dinner (Closing)
                    </button>
                </div>

                <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 leading-tight animate-in fade-in slide-in-from-bottom-2">
                    {activeMeal === 'breakfast' 
                        ? <>Trigger Muscle Synthesis within <span className="text-sync-orange">15 Minutes</span> of Waking.</>
                        : activeMeal === 'lunch' 
                        ? <>Sustain Anabolism with the <span className="text-teal-400">Midday Anchor</span>.</>
                        : <>The Final <span className="text-indigo-300">Anabolic Signal</span> Before the Fast.</>
                    }
                </h1>
                <p className="text-lg md:text-xl text-gray-300 mb-10 leading-relaxed">
                    {activeMeal === 'breakfast'
                        ? "The Sync-60 Protocol relies on one strict rule: The 30g Anchor. Every breakfast must contain 30g of high-quality protein to hit the \"hidden\" threshold of 2.5g Leucine."
                        : activeMeal === 'lunch'
                        ? "The Midday Meal Architecture ensures the metabolic switch remains flipped. 35-45g of protein to maintain the nitrogen balance and fuel afternoon performance."
                        : "The Closing Anchor minimizes overnight catabolism. Emphasizing slow-digesting proteins and low-glycemic sources to align with the Digital Sunset."
                    }
                </p>
                <div className="flex justify-center gap-4">
                    <button onClick={() => document.getElementById('cookbook')?.scrollIntoView({ behavior: 'smooth' })} className={`px-8 py-3 hover:brightness-110 text-white rounded-xl font-bold transition shadow-lg ${activeMeal === 'breakfast' ? 'bg-sync-orange' : activeMeal === 'lunch' ? 'bg-teal-500' : 'bg-indigo-500'}`}>
                        Explore Recipes
                    </button>
                    <button onClick={() => document.getElementById('audit')?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition border border-white/20">
                        See Data
                    </button>
                </div>
            </div>
            {/* Background decoration */}
            <div className={`absolute top-[-50%] left-[-20%] w-[800px] h-[800px] rounded-full blur-3xl opacity-20 transition-colors duration-500 ${activeMeal === 'breakfast' ? 'bg-sync-orange' : activeMeal === 'lunch' ? 'bg-teal-400' : 'bg-indigo-400'}`}></div>
        </section>

        {/* LEUCINE AUDIT */}
        <section id="audit">
            <div className="text-center mb-10 max-w-3xl mx-auto">
                <h2 className="text-3xl font-display font-bold text-sync-blue mb-4">The Leucine Audit</h2>
                <p className="text-gray-600">
                    Not all proteins are created equal. To trigger mTOR (growth/repair), you need ~2.5g of Leucine. 
                    Below shows how much Leucine is in exactly <strong>30g of Protein</strong> from different sources.
                </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={leucineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{fontSize: 12}} interval={0} angle={-45} textAnchor="end" height={60} />
                                <YAxis label={{ value: 'Leucine (g)', angle: -90, position: 'insideLeft' }} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}} />
                                <ReferenceLine y={2.5} stroke="#E06C3E" strokeDasharray="3 3" label={{ value: 'mTOR Threshold (2.5g)', fill: '#E06C3E', position: 'top' }} />
                                <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                                    {leucineData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.val >= 2.5 ? '#10B981' : '#EF4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col justify-center space-y-4">
                        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                            <h3 className="font-bold text-red-800 mb-1">The Vegan Challenge</h3>
                            <p className="text-sm text-red-700">
                                Hemp and Seitan fail the 2.5g threshold even at 30g total protein. They must be paired with high-leucine "Boosters" like Pea Protein.
                            </p>
                        </div>
                        <div className="p-4 bg-sync-blue/10 border-l-4 border-sync-blue rounded-r-lg">
                            <h3 className="font-bold text-sync-blue mb-1">The Whey Advantage</h3>
                            <p className="text-sm text-sync-blue/80">
                                Whey is the most efficient Leucine delivery system (~11%). It hits the threshold with just 23g of total protein.
                            </p>
                        </div>
                        <div className="p-4 bg-orange-50 border-l-4 border-sync-orange rounded-r-lg">
                            <h3 className="font-bold text-orange-800 mb-1">The Egg Standard</h3>
                            <p className="text-sm text-orange-700">
                                Eggs are the "Gold Standard" for bioavailability. 30g of egg protein (approx. 4-5 eggs) safely clears the threshold.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* COOKBOOK SECTION */}
        <section id="cookbook" className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <div className="text-center mb-10">
                <h2 className={`text-3xl font-display font-bold mb-2 ${activeMeal === 'breakfast' ? 'text-sync-blue' : activeMeal === 'lunch' ? 'text-teal-900' : 'text-indigo-900'}`}>The 7-Day Rotation</h2>
                <p className="text-gray-500">
                    {activeMeal === 'breakfast' 
                        ? '21 Recipes Engineered for Speed, Bioavailability, and mTOR Activation.'
                        : activeMeal === 'lunch'
                        ? '21 Lunches Optimized for the 10-Hour Feeding Window.'
                        : '21 Dinners Designed for Sustained Release & Sleep Quality.'}
                </p>
            </div>

            {/* Diet Tabs */}
            <div className="flex justify-center mb-10 space-x-2">
                <button 
                    onClick={() => setActiveTab('omnivore')}
                    className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'omnivore' ? `${theme.bg} text-white shadow-lg` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    Omnivore
                </button>
                <button 
                    onClick={() => setActiveTab('vegetarian')}
                    className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'vegetarian' ? 'bg-sync-blue text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    Vegetarian
                </button>
                <button 
                    onClick={() => setActiveTab('vegan')}
                    className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'vegan' ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    Vegan
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {currentRecipes.filter(r => r.type === activeTab).map((recipe) => (
                    <div key={recipe.id} className="bg-sync-base rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-all hover:-translate-y-1 flex flex-col h-full relative group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-2 items-center flex-wrap">
                                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${
                                    recipe.type === 'omnivore' ? `${theme.bgLight} ${theme.textDark}` :
                                    recipe.type === 'vegetarian' ? 'bg-blue-100 text-blue-800' :
                                    'bg-green-100 text-green-800'
                                }`}>
                                    {recipe.type}
                                </span>
                                {recipe.glutenFree && (
                                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                        Gluten Free
                                    </span>
                                )}
                            </div>
                            <span className="text-xs font-medium text-gray-500 flex items-center mr-10">
                                ⏱ {recipe.time}
                            </span>
                        </div>
                        
                        <h3 className="text-xl font-bold text-sync-blue mb-2 leading-tight font-display pr-8">{recipe.name}</h3>
                        
                        {/* Add to Plan Toggle */}
                        <button 
                            onClick={(e) => toggleRecipe(recipe.id, e)}
                            className={`absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full transition-all shadow-sm ${mealPlan.includes(recipe.id) ? 'bg-green-500 text-white' : 'bg-white text-gray-300 border border-gray-200 hover:border-green-500 hover:text-green-500'}`}
                            title={mealPlan.includes(recipe.id) ? "Remove from Meal Plan" : "Add to Meal Plan"}
                        >
                            {mealPlan.includes(recipe.id) ? '✓' : '+'}
                        </button>
                        
                        <div className="flex items-center space-x-4 mb-6 mt-auto pt-4">
                            <div className="flex-1">
                                <p className="text-xs text-gray-500 uppercase font-bold">Protein</p>
                                <p className="text-2xl font-bold text-gray-800">{recipe.protein}g</p>
                            </div>
                            
                            {/* Leucine Donut Chart */}
                            <div className="w-16 h-16 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { value: recipe.leucine, fill: recipe.leucine >= 2.5 ? '#10B981' : '#EF4444' },
                                                { value: Math.max(0, 3 - recipe.leucine), fill: '#E5E7EB' }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={15}
                                            outerRadius={25}
                                            dataKey="value"
                                            startAngle={90}
                                            endAngle={-270}
                                            stroke="none"
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="text-[10px] font-bold text-gray-400">Leu</span>
                                </div>
                            </div>

                            <div className="flex-1 text-right">
                                <p className="text-xs text-gray-500 uppercase font-bold">Leucine</p>
                                <p className={`text-2xl font-bold ${recipe.leucine >= 2.5 ? 'text-green-600' : 'text-red-500'}`}>{recipe.leucine}g</p>
                            </div>
                        </div>

                        <button 
                            onClick={() => setSelectedRecipe(recipe)}
                            className={`w-full py-3 rounded-xl text-white font-bold text-sm transition shadow-sm ${
                                recipe.type === 'omnivore' ? `${theme.bg} ${theme.hoverBg}` :
                                recipe.type === 'vegetarian' ? 'bg-sync-blue hover:bg-sync-dark' :
                                'bg-green-600 hover:bg-green-700'
                            }`}
                        >
                            View Recipe
                        </button>

                        {/* Special Buttons for All Dinner Recipes, Lunch Recipes, and Vegan/Vegetarian/Omnivore Breakfast */}
                        {(activeMeal === 'dinner' || activeMeal === 'lunch' || (activeMeal === 'breakfast' && (activeTab === 'vegan' || activeTab === 'vegetarian' || activeTab === 'omnivore'))) && (
                            <div className="grid grid-cols-3 gap-2 mt-3 animate-in fade-in slide-in-from-top-1">
                                <button 
                                    onClick={() => setSpecialModal({ type: 'macros', recipeId: recipe.id })} 
                                    className={`py-2 border rounded-lg text-xs font-bold transition-colors shadow-sm ${activeMeal === 'lunch' ? 'bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200' : activeMeal === 'breakfast' ? 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'}`}
                                >
                                    Macros
                                </button>
                                <button 
                                    onClick={() => setSpecialModal({ type: 'why', recipeId: recipe.id })} 
                                    className={`py-2 border rounded-lg text-xs font-bold transition-colors shadow-sm ${activeMeal === 'lunch' ? 'bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200' : activeMeal === 'breakfast' ? 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'}`}
                                >
                                    Why
                                </button>
                                <button 
                                    onClick={() => setSpecialModal({ type: 'instructions', recipeId: recipe.id })} 
                                    className={`py-2 border rounded-lg text-xs font-bold transition-colors shadow-sm ${activeMeal === 'lunch' ? 'bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200' : activeMeal === 'breakfast' ? 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'}`}
                                >
                                    Steps
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>

        {/* View Meal Plan Floating Button */}
        {mealPlan.length > 0 && (
            <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 fade-in">
                <button 
                    onClick={() => setViewMode('plan')}
                    className="bg-sync-dark text-white px-8 py-4 rounded-full font-bold shadow-2xl hover:scale-105 transition-transform flex items-center gap-3 ring-4 ring-white/50"
                >
                    <span>View Meal Plan</span>
                    <span className="bg-sync-orange text-white text-xs px-2 py-1 rounded-full">{mealPlan.length}</span>
                </button>
            </div>
        )}

        {/* SPECIAL INFO MODAL */}
        {specialModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-sync-dark/60 backdrop-blur-sm" onClick={() => setSpecialModal(null)}></div>
                <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                        <h3 className="text-2xl font-bold text-indigo-900 font-display">
                            {currentRecipes.find(r => r.id === specialModal.recipeId)?.name}
                        </h3>
                        <button onClick={() => setSpecialModal(null)} className="text-gray-400 hover:text-indigo-600 text-2xl transition-colors">&times;</button>
                    </div>

                    <div className="prose prose-indigo max-w-none text-gray-700">
                        {getSpecialContent()}
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                        <button 
                            onClick={() => setSpecialModal(null)}
                            className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            Close Info
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* RECIPE MODAL (Standard) */}
        {selectedRecipe && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-sync-dark/60 backdrop-blur-sm" onClick={() => setSelectedRecipe(null)}></div>
                <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-2xl font-bold text-sync-blue font-display">{selectedRecipe.name}</h3>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{selectedRecipe.type}</span>
                        </div>
                        <button onClick={() => setSelectedRecipe(null)} className={`text-gray-400 text-2xl transition-colors ${activeMeal === 'breakfast' ? 'hover:text-sync-orange' : activeMeal === 'lunch' ? 'hover:text-teal-600' : 'hover:text-indigo-600'}`}>&times;</button>
                    </div>

                    <div className="flex gap-6 mb-8 border-b border-gray-100 pb-6">
                        <div>
                            <p className="text-xs text-gray-500 uppercase">Protein</p>
                            <p className="text-xl font-bold text-sync-dark">{selectedRecipe.protein}g</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase">Leucine</p>
                            <p className={`text-xl font-bold ${activeMeal === 'breakfast' ? 'text-sync-orange' : activeMeal === 'lunch' ? 'text-teal-600' : 'text-indigo-500'}`}>{selectedRecipe.leucine}g</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase">Time</p>
                            <p className="text-xl font-bold text-gray-600">{selectedRecipe.time}</p>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h4 className="text-sm font-bold text-sync-blue uppercase tracking-wide mb-3">Anchor Ingredients</h4>
                        <ul className="space-y-2 bg-gray-50 p-4 rounded-xl text-sm text-gray-700">
                            {selectedRecipe.ingredients.map((ing: string, i: number) => (
                                <li key={i} className="flex items-start gap-2">
                                    <span className={activeMeal === 'breakfast' ? 'text-sync-orange' : activeMeal === 'lunch' ? 'text-teal-600' : 'text-indigo-500'}>•</span>
                                    <span>{ing}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex gap-3">
                        <span className="text-2xl">👨‍🍳</span>
                        <div>
                            <h4 className="text-xs font-bold text-yellow-800 uppercase tracking-wide mb-1">Chef's Note</h4>
                            <p className="text-sm text-yellow-800/80 italic">{selectedRecipe.note}</p>
                        </div>
                    </div>

                    <div className="mt-8 flex gap-4">
                        <button 
                            onClick={(e) => {toggleRecipe(selectedRecipe.id, e); setSelectedRecipe(null);}}
                            className={`flex-1 py-3 font-bold rounded-xl transition-colors ${mealPlan.includes(selectedRecipe.id) ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        >
                            {mealPlan.includes(selectedRecipe.id) ? 'Remove from Plan' : 'Add to Plan'}
                        </button>
                        <button 
                            onClick={() => setSelectedRecipe(null)}
                            className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}

      </main>
    </div>
  );
};

export default Cookbook;