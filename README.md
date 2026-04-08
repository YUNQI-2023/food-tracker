# Food Tracker - Personal Food Inventory & Nutrition Tracking

A local single-user web app for tracking food inventory from Walmart grocery purchases, monitoring expiry dates, logging meals, tracking nutrition, and getting recipe recommendations.

## Quick Start

```bash
# Install dependencies
npm install

# Set up database (generate client, push schema, seed data)
npm run setup

# Start dev server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Features

- **Dashboard** - Overview of inventory status, expiring items, today's nutrition, weekly calorie chart, recipe suggestions
- **Import Purchases** - CSV upload, paste text, or PDF upload from Walmart receipts. Review and edit parsed items before importing.
- **Inventory** - View all food items with expiry status badges. Filter by status or category. Quick actions: use, restock, mark opened, mark finished.
- **Meals** - Log meals from inventory items. Auto-calculates nutrition. View meals by date.
- **Nutrition** - Daily calorie and macro charts. 7/14/30 day views.
- **Recipes** - 12 seeded recipes scored by ingredient availability. Prioritizes expiring items. "Cook this" action deducts from inventory.

## Tech Stack

- Next.js 16 with App Router
- TypeScript
- Tailwind CSS v4
- Prisma with SQLite
- Zod v4 for validation
- date-fns for date logic
- Recharts for charts
- PapaParse for CSV parsing
- pdf-parse for PDF text extraction

## Project Structure

```
src/
├── app/
│   ├── api/          # API route handlers
│   │   ├── dashboard/
│   │   ├── imports/
│   │   ├── inventory/
│   │   ├── meals/
│   │   ├── nutrition/
│   │   └── recipes/
│   ├── dashboard/    # Dashboard page
│   ├── imports/      # Import purchases page
│   ├── inventory/    # Inventory management page
│   ├── meals/        # Meal logging page
│   ├── nutrition/    # Nutrition tracking page
│   └── recipes/      # Recipe recommendations page
├── components/       # Shared components
└── lib/              # Core utilities
    ├── db.ts         # Prisma client
    ├── expiry.ts     # Expiry date calculation
    ├── nutrition.ts  # Nutrition calculation
    ├── categories.ts # Category mapping
    ├── import-parser.ts # CSV/text/PDF parsing
    ├── recipe-scoring.ts # Recipe recommendation engine
    ├── schemas.ts    # Zod validation schemas
    └── utils.ts      # Tailwind utilities
prisma/
├── schema.prisma     # Database schema
└── seed.ts           # Seed data
public/
└── samples/
    └── walmart-sample.csv  # Sample import file
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run setup` | Initialize database with seed data |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
| `npm run db:seed` | Re-seed the database |

## Sample Data

The app comes pre-seeded with:
- 20 common grocery products with nutrition data
- 18 inventory batches (some expiring soon)
- 12 recipes with ingredients
- 5 sample consumption logs
- A sample Walmart CSV file at `/public/samples/walmart-sample.csv`

## Business Logic

### Expiry Calculation Priority
1. Explicit `expiryDate` if set
2. `openedDate + openedShelfLifeDays` if item is opened
3. `estimatedExpiryDate` if set
4. `purchaseDate + shelfLifeDays` as fallback

### Status Values
- **Fresh** - Not expiring within 7 days
- **Expiring Soon** - Within 7 days of expiry
- **Expired** - Past expiry date
- **Consumed** - Fully used up

### Recipe Scoring
- Higher score for recipes using expiring-soon items (+15 per match)
- Higher score for more ingredient coverage
- Penalty for missing required ingredients (-20 each)
- Bonus for full ingredient availability (+20)

### Nutrition
- Calculated from per-100g values when weight is available
- Units converted to grams via `gramsPerUnit` on products
- Null nutrition if weight/nutrition data is unknown

## Assumptions & Limitations

- **Single user only** - No authentication
- **Local only** - SQLite database, no cloud deployment
- **Walmart focus** - Parser is tuned for Walmart receipt formats but works with generic CSV/text
- **Approximate nutrition** - Based on generic per-100g values, not exact product data
- **No image OCR** - PDF parsing is text-based only
- **Deterministic recipes** - Rule-based scoring, no AI/LLM
- **No barcode scanning** - Manual import only
- **Shelf life estimates** - Based on general food safety guidelines, may not match specific products
