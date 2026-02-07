# Lounge & Service Management System

A comprehensive Node.js/TypeScript backend system for managing beauty salons (lounges) and their services using Express.js, MongoDB, and Mongoose.

## 🏗️ System Architecture

### User Types
- **Users**: Regular platform users
- **Clients**: Customers who book services
- **Lounges**: Beauty salons/service providers
- **Admins**: System administrators

## 💇‍♀️ Service Management System

### Core Models

#### ServiceCategory
Global categories for organizing services (e.g., "Hair Services", "Nail Services", "Facial Treatments").

```typescript
interface ServiceCategory {
  _id: string;
  name: string; // Unique category name
  createdAt: Date;
  updatedAt: Date;
}
```

#### Service
Global service catalog - normalized to prevent duplicates.

```typescript
interface Service {
  _id: string;
  name: string;        // e.g., "Haircut", "Manicure"
  slug: string;        // URL-friendly identifier
  gender: 'men' | 'women' | 'unisex' | 'kids';
  categoryId: string;  // Reference to ServiceCategory
  baseDuration?: number; // Base duration in minutes
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}
```

#### ServiceSuggestion
Allows lounges to suggest new services that don't exist in the global catalog.

```typescript
interface ServiceSuggestion {
  _id: string;
  name: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected' | 'implemented';
  loungeId: string;    // Lounge that made the suggestion
  createdAt: Date;
  updatedAt: Date;
}
```

#### LoungeService
Links lounges to services with lounge-specific pricing and details.

```typescript
interface LoungeService {
  _id: string;
  loungeId: string;    // Reference to Lounge user
  serviceId: string;   // Reference to global Service
  price: number;       // Price in cents (e.g., 2500 = $25.00)
  duration: number;    // Duration in minutes
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## 🏪 Lounge User Features

### Lounge Profile
```typescript
interface Lounge extends User {
  loungeTitle?: string;
  openingHours?: {
    monday?: { from?: string; to?: string };
    tuesday?: { from?: string; to?: string };
    // ... all days of the week
  };
}
```

### Key Lounge Capabilities
- **Service Offering**: Add services from global catalog with custom pricing
- **Opening Hours**: Set weekly schedule for each day
- **Service Suggestions**: Propose new services for admin approval
- **Profile Management**: Update lounge information and branding

## 🔄 Service Flow

### 1. Service Creation (Admin Only)
```typescript
// Admin creates service categories
const hairCategory = await ServiceCategory.create({
  name: "Hair Services"
});

// Admin creates global services
const haircut = await Service.create({
  name: "Haircut",
  slug: "haircut",
  gender: "unisex",
  categoryId: hairCategory._id,
  baseDuration: 30,
  status: "active"
});
```

### 2. Lounge Service Offering
```typescript
// Lounge adds service with custom pricing
const loungeHaircut = await LoungeService.create({
  loungeId: "lounge123",
  serviceId: haircut._id,
  price: 2500,        // $25.00
  duration: 45,       // 45 minutes
  description: "Professional haircut with styling",
  isActive: true
});
```

### 3. Service Suggestion Flow
```typescript
// Lounge suggests new service
const suggestion = await ServiceSuggestion.create({
  name: "Special Hair Treatment",
  description: "Premium conditioning treatment",
  loungeId: "lounge123"
});

// Admin reviews and approves
await ServiceSuggestion.findByIdAndUpdate(suggestion._id, {
  status: "approved"
});

// Admin creates the service
const newService = await Service.create({
  name: "Special Hair Treatment",
  slug: "special-hair-treatment",
  gender: "unisex",
  categoryId: hairCategory._id,
  baseDuration: 60
});

// Mark suggestion as implemented
await ServiceSuggestion.findByIdAndUpdate(suggestion._id, {
  status: "implemented"
});
```

## 📊 Database Relationships

```
ServiceCategory (1) ──── (M) Service
                              │
                              │
                              │
LoungeService ◄───────────────┘
                              │
                              │
                              │
Lounge (1) ──────────────── (M) ServiceSuggestion
```

### Key Constraints
- **No Free-Text Services**: Lounges must use existing global services
- **Unique Service Names**: Prevents duplicates like "Haircut" vs "Hair Cut"
- **Unique Lounge-Service Pairs**: One lounge can't offer the same service twice
- **Category Organization**: Services are grouped by categories

## 🚀 API Endpoints Overview

### Service Management
- `POST /api/services/categories` - Create service category
- `GET /api/services/categories` - List categories
- `POST /api/services` - Create global service
- `GET /api/services` - List services (with filtering)

### Lounge Management
- `POST /api/lounges/services` - Add service to lounge
- `GET /api/lounges/{id}/services` - Get lounge services
- `PUT /api/lounges/services/{id}` - Update lounge service

### Service Suggestions
- `POST /api/suggestions` - Create service suggestion
- `GET /api/suggestions` - List suggestions (admin)
- `PUT /api/suggestions/{id}` - Update suggestion status

## 💡 Business Logic

### Service Discovery
1. **Global Catalog**: Centralized service definitions
2. **Category Browsing**: Services organized by type
3. **Gender Filtering**: Target specific demographics
4. **Status Management**: Active/inactive services

### Lounge Operations
1. **Service Selection**: Choose from global catalog
2. **Pricing Strategy**: Set competitive prices
3. **Duration Management**: Adjust service times
4. **Availability Control**: Enable/disable services

### Quality Assurance
1. **Standardization**: Consistent service naming
2. **Categorization**: Logical service grouping
3. **Suggestion Workflow**: Community-driven service expansion
4. **Admin Oversight**: Quality control and approval process

## 🛠️ Technical Features

### Data Integrity
- **Unique Constraints**: Prevent duplicate services and categories
- **Foreign Key Relationships**: Maintain referential integrity
- **Enum Validation**: Controlled vocabularies for status and gender
- **Indexing**: Optimized database queries

### Scalability
- **Normalized Design**: Efficient storage and updates
- **Flexible Pricing**: Lounge-specific customization
- **Extensible Categories**: Easy addition of new service types
- **Status Tracking**: Workflow management for suggestions

## 📈 Usage Examples

### For Lounges
```typescript
// Get available services
const services = await Service.find({ status: 'active' })
  .populate('categoryId', 'name');

// Add service to lounge
const loungeService = await LoungeService.create({
  loungeId: req.user._id,
  serviceId: selectedService._id,
  price: 3000, // $30.00
  duration: 60
});
```

### For Clients
```typescript
// Find lounges offering specific service
const lounges = await LoungeService.find({
  serviceId: haircutService._id,
  isActive: true
}).populate('loungeId', 'loungeTitle location');

// Filter by price range
const affordableServices = await LoungeService.find({
  serviceId: haircutService._id,
  price: { $lte: 2500 }, // Under $25
  isActive: true
});
```

## 🔐 Security & Validation

- **Role-Based Access**: Different permissions for users, lounges, admins
- **Input Validation**: Comprehensive DTOs with class-validator
- **Data Sanitization**: Trimmed strings and controlled inputs
- **Audit Trail**: Timestamps and status tracking

## 🎯 Future Enhancements

- Service booking system
- Client reviews and ratings
- Service packages/bundles
- Loyalty programs
- Analytics dashboard
- Mobile app integration

---

## Prerequisites
- Node.js 16+ and npm
- MongoDB (local or hosted)

## Setup
1. Install dependencies:

```bash
npm install
```

2. Create a local environment file (example `.env`):

```
DB_HOST=127.0.0.1
DB_PORT=27017
DB_DATABASE=dev
JWT_SECRET=your_jwt_secret
PORT=3000
```

## Run (development)

```bash
npm run dev
```

## Build & Run (production)

```bash
npm run build
npm start
```

---

**Built with**: Node.js, TypeScript, Express.js, MongoDB, Mongoose
**Architecture**: RESTful API with normalized database design</content>
<parameter name="oldString">## Prerequisites