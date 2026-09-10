/**
 * SheetPunch - Application Constants
 */
window.SheetPunch = window.SheetPunch || window.CrewClock || {};
window.CrewClock = window.SheetPunch;

(function (exports) {
  'use strict';

  // --- LOCAL STORAGE KEYS ---
  const STORAGE_KEYS = {
    SETTINGS: 'sheetpunch_settings_v3',
    SESSION: 'sheetpunch_user_session',
    ACTIVE_SHIFT: 'clockin_active_shift',
    HISTORY: 'clockin_history',
    PUNCH_QUEUE: 'sheetpunch_punch_queue'
  };

  // Default Session Duration: 7 days
  const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

  // Standard Attendance Sheet Columns (11 columns)
  const SHEET_HEADERS = [
    'Date',
    'Employee Name',
    'Email',
    'Clock In Time',
    'Clock In Coordinates',
    'Clock In Map',
    'Clock Out Time',
    'Shift Duration',
    'Clock Out Coordinates',
    'Clock Out Map',
    'Status'
  ];

  // --- SMB BUSINESS CATEGORIES ---
  const BUSINESS_TYPES = [
    { icon: '🍽️', name: 'Restaurant, Cafe & Bakery' },
    { icon: '🛍️', name: 'Retail Store & Boutique' },
    { icon: '🔨', name: 'Construction & General Contracting' },
    { icon: '🏥', name: 'Healthcare, Clinic & Dental' },
    { icon: '💇', name: 'Salon, Spa & Barbershop' },
    { icon: '🧹', name: 'Cleaning & Janitorial Services' },
    { icon: '🚚', name: 'Logistics, Moving & Warehousing' },
    { icon: '🏨', name: 'Hospitality, Hotel & Lodging' },
    { icon: '🚗', name: 'Automotive Repair & Dealership' },
    { icon: '🏋️', name: 'Fitness Gym, Yoga & Martial Arts' },
    { icon: '🛠️', name: 'Plumbing, HVAC & Electrical' },
    { icon: '🌿', name: 'Landscaping & Grounds Care' },
    { icon: '📦', name: 'Wholesale, Supply & Distribution' },
    { icon: '🎓', name: 'Education, Daycare & Tutoring' },
    { icon: '☕', name: 'Coffee Shop & Food Truck' },
    { icon: '💻', name: 'IT, Tech & Consulting Services' },
    { icon: '🛡️', name: 'Security & Facility Management' },
    { icon: '🎨', name: 'Creative Agency, Studio & Media' },
    { icon: '🐾', name: 'Pet Care, Grooming & Veterinary' },
    { icon: '🏢', name: 'Real Estate & Property Management' },
    { icon: '⚖️', name: 'Accounting, Tax & Legal Services' },
    { icon: '🌐', name: 'General Business / Other' }
  ];

  // --- PRICING PLANS (WEB BASE & MOBILE STORE OPTION B) ---
  const PRICING_PLANS = {
    starter: {
      key: 'starter',
      name: 'Starter Crew',
      teamSize: 'Up to 15 Employees',
      web: {
        monthlyPrice: 9.99,
        yearlyPrice: 99.00,
        monthlyPriceFormatted: '$9.99',
        yearlyPriceFormatted: '$99.00',
        originalMonthlyPriceFormatted: '$19',
        originalYearlyPriceFormatted: '$190',
        monthlyPeriod: ' / mo',
        yearlyPeriod: ' / yr',
        monthlySubtext: '🔥 Launch Special (Billed monthly)',
        yearlySubtext: '🔥 Launch Special · $8.25/mo (Save 48%)'
      },
      mobile: {
        monthlyPrice: 11.99,
        yearlyPrice: 119.00,
        monthlyPriceFormatted: '$11.99',
        yearlyPriceFormatted: '$119.00',
        originalMonthlyPriceFormatted: '$22',
        originalYearlyPriceFormatted: '$220',
        monthlyPeriod: ' / mo',
        yearlyPeriod: ' / yr',
        monthlySubtext: 'Billed monthly (includes 15% store fee)',
        yearlySubtext: '$9.92/mo (Billed $119/yr, includes 15% store fee)'
      },
      originalWeb: {
        monthlyPriceFormatted: '$19',
        yearlyPriceFormatted: '$190'
      },
      monthlyPrice: 9.99,
      yearlyPrice: 99.00,
      monthlyPriceFormatted: '$9.99',
      yearlyPriceFormatted: '$99.00',
      originalMonthlyPriceFormatted: '$19',
      originalYearlyPriceFormatted: '$190',
      monthlyPeriod: ' / mo',
      yearlyPeriod: ' / yr',
      monthlySubtext: '🔥 Launch Special (Billed monthly)',
      yearlySubtext: '🔥 Launch Special · $8.25/mo (Save 48%)',
      features: [
        'Instant Sheet sync',
        'Unlimited punches',
        'Mobile web/app clock-in',
        'Up to 15 active employees'
      ]
    },
    growth: {
      key: 'growth',
      name: 'Growth Crew',
      teamSize: '16 – 35 Employees',
      web: {
        monthlyPrice: 19.99,
        yearlyPrice: 199.00,
        monthlyPriceFormatted: '$19.99',
        yearlyPriceFormatted: '$199.00',
        originalMonthlyPriceFormatted: '$39',
        originalYearlyPriceFormatted: '$390',
        monthlyPeriod: ' / mo',
        yearlyPeriod: ' / yr',
        monthlySubtext: '🔥 Launch Special (Billed monthly)',
        yearlySubtext: '🔥 Launch Special · $16.58/mo (Save 49%)'
      },
      mobile: {
        monthlyPrice: 23.99,
        yearlyPrice: 239.00,
        monthlyPriceFormatted: '$23.99',
        yearlyPriceFormatted: '$239.00',
        originalMonthlyPriceFormatted: '$45',
        originalYearlyPriceFormatted: '$450',
        monthlyPeriod: ' / mo',
        yearlyPeriod: ' / yr',
        monthlySubtext: 'Billed monthly (includes 15% store fee)',
        yearlySubtext: '$19.92/mo (Billed $239/yr, includes 15% store fee)'
      },
      originalWeb: {
        monthlyPriceFormatted: '$39',
        yearlyPriceFormatted: '$390'
      },
      monthlyPrice: 19.99,
      yearlyPrice: 199.00,
      monthlyPriceFormatted: '$19.99',
      yearlyPriceFormatted: '$199.00',
      originalMonthlyPriceFormatted: '$39',
      originalYearlyPriceFormatted: '$390',
      monthlyPeriod: ' / mo',
      yearlyPeriod: ' / yr',
      monthlySubtext: '🔥 Launch Special (Billed monthly)',
      yearlySubtext: '🔥 Launch Special · $16.58/mo (Save 49%)',
      features: [
        'All Starter features included',
        'Multi-department tabs',
        'Daily summary alerts',
        '16 – 35 active employees'
      ]
    },
    scale: {
      key: 'scale',
      name: 'Pro Crew',
      teamSize: '36 – 50 Employees',
      web: {
        monthlyPrice: 24.99,
        yearlyPrice: 249.00,
        monthlyPriceFormatted: '$24.99',
        yearlyPriceFormatted: '$249.00',
        originalMonthlyPriceFormatted: '$49',
        originalYearlyPriceFormatted: '$490',
        monthlyPeriod: ' / mo',
        yearlyPeriod: ' / yr',
        monthlySubtext: '🔥 Launch Special (Billed monthly)',
        yearlySubtext: '🔥 Launch Special · $20.75/mo (Save 49%)'
      },
      mobile: {
        monthlyPrice: 29.99,
        yearlyPrice: 299.00,
        monthlyPriceFormatted: '$29.99',
        yearlyPriceFormatted: '$299.00',
        originalMonthlyPriceFormatted: '$58',
        originalYearlyPriceFormatted: '$580',
        monthlyPeriod: ' / mo',
        yearlyPeriod: ' / yr',
        monthlySubtext: 'Billed monthly (includes 15% store fee)',
        yearlySubtext: '$24.92/mo (Billed $299/yr, includes 15% store fee)'
      },
      originalWeb: {
        monthlyPriceFormatted: '$49',
        yearlyPriceFormatted: '$490'
      },
      monthlyPrice: 24.99,
      yearlyPrice: 249.00,
      monthlyPriceFormatted: '$24.99',
      yearlyPriceFormatted: '$249.00',
      originalMonthlyPriceFormatted: '$49',
      originalYearlyPriceFormatted: '$490',
      monthlyPeriod: ' / mo',
      yearlyPeriod: ' / yr',
      monthlySubtext: '🔥 Launch Special (Billed monthly)',
      yearlySubtext: '🔥 Launch Special · $20.75/mo (Save 49%)',
      features: [
        'All Growth features included',
        'Priority support',
        'Custom shift tagging',
        '36 – 50 active employees'
      ]
    }
  };

  // Export to namespace
  exports.STORAGE_KEYS = STORAGE_KEYS;
  exports.SESSION_DURATION_MS = SESSION_DURATION_MS;
  exports.SHEET_HEADERS = SHEET_HEADERS;
  exports.BUSINESS_TYPES = BUSINESS_TYPES;
  exports.PRICING_PLANS = PRICING_PLANS;

  // Global fallbacks for backwards compatibility
  window.STORAGE_KEYS = STORAGE_KEYS;
  window.SESSION_DURATION_MS = SESSION_DURATION_MS;
  window.SHEET_HEADERS = SHEET_HEADERS;
  window.BUSINESS_TYPES = BUSINESS_TYPES;
  window.PRICING_PLANS = PRICING_PLANS;

})(window.SheetPunch);
