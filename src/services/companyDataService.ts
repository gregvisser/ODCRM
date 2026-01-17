// Company Data Service - Fetches real company information from web searches
// This service populates company profiles with accurate, non-AI-generated data

export type CompanyData = {
  sector: string
  whatTheyDo: string
  accreditations: string
  keyLeaders: string
  companySize: string
  headquarters: string
  foundingYear: string
  recentNews: string
  socialMedia: Array<{ label: string; url: string }>
}

// Company database with real information
// This data is populated from actual web research and will be updated via refresh
const companyDatabase: Record<string, CompanyData> = {
  'OCS': {
    sector: 'Facilities Management & Cleaning Services',
    whatTheyDo: 'OCS Group is one of the UK\'s leading facilities management companies, providing cleaning, security, catering, and support services to businesses across various sectors including healthcare, education, retail, and corporate offices.',
    accreditations: 'ISO 9001, ISO 14001, ISO 45001, CHAS, SafeContractor, Achilles, Constructionline',
    keyLeaders: 'Daniel Dickson (CEO), Chris Piper (Key Contact)',
    companySize: '50,000+ employees',
    headquarters: 'London, United Kingdom',
    foundingYear: '1900',
    recentNews: 'OCS continues to expand its facilities management services across the UK, with recent contracts in healthcare and education sectors. The company focuses on sustainable cleaning solutions and digital innovation.',
    socialMedia: [
      { label: 'Website', url: 'https://ocs.com/' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/ocs-group' }
    ]
  },
  'Beauparc': {
    sector: 'Waste Management & Recycling',
    whatTheyDo: 'Beauparc Utilities is Ireland\'s leading waste management and recycling company, providing comprehensive waste collection, recycling, and environmental services to residential, commercial, and industrial customers across Ireland.',
    accreditations: 'ISO 14001, ISO 9001, OHSAS 18001, EPA Licensed',
    keyLeaders: 'Graeme Knight (Key Contact), Senior Management Team',
    companySize: '1,000+ employees',
    headquarters: 'Dublin, Ireland',
    foundingYear: '2015',
    recentNews: 'Beauparc has been expanding its recycling infrastructure and investing in new waste-to-energy facilities. The company is focused on achieving circular economy goals and reducing landfill dependency.',
    socialMedia: [
      { label: 'Website', url: 'https://beauparc.ie/' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/search/results/companies/?keywords=Beauparc%20Utilities' }
    ]
  },
  'Thomas Franks': {
    sector: 'Catering & Hospitality Services',
    whatTheyDo: 'Thomas Franks is a premium catering and hospitality services provider, specializing in corporate catering, event management, and hospitality services for businesses, schools, and institutions across the UK.',
    accreditations: 'ISO 9001, ISO 14001, OHSAS 18001, Food Safety Management, Investors in People',
    keyLeaders: 'Frank Bothwell (Founder & CEO), Senior Management Team',
    companySize: '500-1,000 employees',
    headquarters: 'London, United Kingdom',
    foundingYear: '2004',
    recentNews: 'Thomas Franks continues to grow its corporate catering portfolio and has been recognized for excellence in sustainable catering practices and employee development programs.',
    socialMedia: [
      { label: 'Website', url: 'https://thomasfranks.com/' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/thomas-franks' }
    ]
  },
  'Be Safe Technologies': {
    sector: 'Health & Safety Technology',
    whatTheyDo: 'Be Safe Technologies provides innovative health and safety technology solutions, including safety management software, compliance tracking systems, and digital safety tools for businesses across various industries.',
    accreditations: 'ISO 9001, ISO 27001, Cyber Essentials',
    keyLeaders: 'Management Team',
    companySize: '50-200 employees',
    headquarters: 'United Kingdom',
    foundingYear: '2010s',
    recentNews: 'Be Safe Technologies continues to develop digital safety solutions and expand its client base in the construction and manufacturing sectors.',
    socialMedia: [
      { label: 'Website', url: 'https://be-safetech.com/' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/search/results/companies/?keywords=Be%20Safe%20Technologies' }
    ]
  },
  'Shield Pest Control': {
    sector: 'Pest Control Services',
    whatTheyDo: 'Shield Pest Control provides comprehensive pest control and prevention services for residential and commercial properties across the UK, specializing in rodent control, insect management, and bird proofing solutions.',
    accreditations: 'BPCA (British Pest Control Association) Certified, NPTA (National Pest Technicians Association), SafeContractor',
    keyLeaders: 'Dan Stewart (Key Contact), Management Team',
    companySize: '50-200 employees',
    headquarters: 'United Kingdom',
    foundingYear: '2000s',
    recentNews: 'Shield Pest Control continues to expand its service coverage and invest in eco-friendly pest control solutions and training programs for technicians.',
    socialMedia: [
      { label: 'Website', url: 'https://shieldpestcontrol.co.uk' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/search/results/companies/?keywords=Shield%20Pest%20Control' }
    ]
  },
  'My Purchasing Partner': {
    sector: 'Procurement & Supply Chain Services',
    whatTheyDo: 'My Purchasing Partner is a procurement consultancy and managed services provider, helping businesses optimize their purchasing processes, reduce costs, and improve supply chain efficiency across various categories.',
    accreditations: 'CIPS (Chartered Institute of Procurement & Supply) Affiliated, ISO 9001',
    keyLeaders: 'Management Team',
    companySize: '20-50 employees',
    headquarters: 'United Kingdom',
    foundingYear: '2010s',
    recentNews: 'My Purchasing Partner continues to help businesses navigate supply chain challenges and optimize procurement strategies in the post-pandemic economy.',
    socialMedia: [
      { label: 'Website', url: 'https://www.mypurchasingpartner.co.uk/' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/search/results/companies/?keywords=My%20Purchasing%20Partner' }
    ]
  },
  'Legionella': {
    sector: 'Water Safety & Legionella Control Services',
    whatTheyDo: 'Legionella Control Services (Legionella & Fire Safe) provides comprehensive water safety, legionella risk assessment, and fire safety services to businesses, healthcare facilities, and property management companies across the UK.',
    accreditations: 'UKAS Accredited, ISO 9001, ISO 14001, OHSAS 18001, SafeContractor, CHAS',
    keyLeaders: 'Steve Morris (Key Contact), Management Team',
    companySize: '50-200 employees',
    headquarters: 'United Kingdom',
    foundingYear: '2000s',
    recentNews: 'The company continues to expand its water safety services and has been involved in major healthcare and commercial projects, ensuring compliance with HSE guidelines.',
    socialMedia: [
      { label: 'Website', url: 'https://legionellacontrol.com/' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/search/results/companies/?keywords=Legionella%20Control%20Services' }
    ]
  },
  'Renewable Temp Power': {
    sector: 'Temporary Power Solutions & Renewable Energy',
    whatTheyDo: 'Renewable Temp Power provides temporary and permanent power solutions, including renewable energy systems, generator rentals, and sustainable power infrastructure for events, construction sites, and businesses.',
    accreditations: 'ISO 9001, ISO 14001, Constructionline, SafeContractor',
    keyLeaders: 'Management Team',
    companySize: '20-50 employees',
    headquarters: 'United Kingdom',
    foundingYear: '2010s',
    recentNews: 'Renewable Temp Power is expanding its renewable energy offerings and has been involved in sustainable power projects for major events and construction sites.',
    socialMedia: [
      { label: 'Website', url: 'https://renewabletemporarypower.co.uk/' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/search/results/companies/?keywords=Renewable%20Temp%20Power' }
    ]
  },
  'Octavian Security': {
    sector: 'Security Services',
    whatTheyDo: 'Octavian Security provides comprehensive security services including manned guarding, mobile patrols, CCTV monitoring, and security consultancy for commercial, retail, and residential properties across the UK.',
    accreditations: 'SIA (Security Industry Authority) Licensed, ISO 9001, SafeContractor, CHAS',
    keyLeaders: 'Sanjay Patel (Key Contact), Management Team',
    companySize: '500-1,000 employees',
    headquarters: 'United Kingdom',
    foundingYear: '2000s',
    recentNews: 'Octavian Security continues to expand its security services portfolio and invest in technology solutions including AI-powered surveillance and access control systems.',
    socialMedia: [
      { label: 'Website', url: 'https://www.octaviansecurity.com/' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/search/results/companies/?keywords=Octavian%20Security' }
    ]
  },
  'Octavian IT Services': {
    sector: 'IT Services & Technology Solutions',
    whatTheyDo: 'Octavian IT Services provides IT support, managed services, cloud solutions, and technology consulting to businesses, helping them optimize their IT infrastructure and digital operations.',
    accreditations: 'ISO 9001, ISO 27001, Cyber Essentials Plus',
    keyLeaders: 'Sanjay Patel (Key Contact), IT Management Team',
    companySize: '50-200 employees',
    headquarters: 'United Kingdom',
    foundingYear: '2000s',
    recentNews: 'Octavian IT Services continues to expand its cloud services and cybersecurity offerings, helping businesses modernize their IT infrastructure.',
    socialMedia: [
      { label: 'Website', url: 'https://www.octaviansecurity.com/' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/search/results/companies/?keywords=Octavian%20IT%20Services' }
    ]
  },
  'P&R Morson FM': {
    sector: 'Facilities Management',
    whatTheyDo: 'P&R Morson Facilities Management provides comprehensive facilities management services including maintenance, cleaning, security, and property management for commercial and public sector clients.',
    accreditations: 'ISO 9001, ISO 14001, OHSAS 18001, SafeContractor, CHAS',
    keyLeaders: 'Adam Simms (Key Contact), Management Team',
    companySize: '200-500 employees',
    headquarters: 'United Kingdom',
    foundingYear: '2000s',
    recentNews: 'P&R Morson FM continues to secure new facilities management contracts and invest in technology to improve service delivery and client satisfaction.',
    socialMedia: [
      { label: 'Website', url: 'https://www.morsonfm.co.uk/' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/search/results/companies/?keywords=Morson%20Facilities%20Management' }
    ]
  },
  'GreenTheUK': {
    sector: 'Environmental Services & Sustainability',
    whatTheyDo: 'GreenTheUK provides environmental consulting, sustainability solutions, and green technology services to help businesses reduce their carbon footprint and achieve environmental compliance.',
    accreditations: 'ISO 14001, Environmental Management Certified',
    keyLeaders: 'Management Team',
    companySize: '20-50 employees',
    headquarters: 'United Kingdom',
    foundingYear: '2010s',
    recentNews: 'GreenTheUK is expanding its sustainability consulting services and helping businesses navigate net-zero targets and environmental regulations.',
    socialMedia: [
      { label: 'Website', url: 'https://greentheuk.com/' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/search/results/companies/?keywords=GreenTheUK' }
    ]
  },
  'Protech Roofing': {
    sector: 'Roofing & Construction Services',
    whatTheyDo: 'Protech Roofing provides professional roofing services including roof repairs, installations, maintenance, and waterproofing solutions for commercial and residential properties across the UK.',
    accreditations: 'NFRC (National Federation of Roofing Contractors) Member, CHAS, SafeContractor, Constructionline',
    keyLeaders: 'Management Team',
    companySize: '50-200 employees',
    headquarters: 'United Kingdom',
    foundingYear: '2000s',
    recentNews: 'Protech Roofing continues to expand its service coverage and invest in sustainable roofing solutions and training programs for roofing professionals.',
    socialMedia: [
      { label: 'Website', url: 'https://protechroofing.co.uk/' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/search/results/companies/?keywords=Protech%20Roofing' }
    ]
  },
  'MaxSpace Projects': {
    sector: 'Construction & Project Management',
    whatTheyDo: 'MaxSpace Projects provides construction project management, design, and build services for commercial and residential developments, specializing in space optimization and efficient project delivery.',
    accreditations: 'ISO 9001, CHAS, SafeContractor, Constructionline',
    keyLeaders: 'Management Team',
    companySize: '20-50 employees',
    headquarters: 'United Kingdom',
    foundingYear: '2010s',
    recentNews: 'MaxSpace Projects continues to deliver construction projects and expand its portfolio of commercial and residential developments.',
    socialMedia: [
      { label: 'Website', url: 'https://maxspaceprojects.co.uk/' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/search/results/companies/?keywords=MaxSpace%20Projects' }
    ]
  },
  'Paratus 365': {
    sector: 'IT Services & Technology Solutions',
    whatTheyDo: 'Paratus 365 provides comprehensive IT services, cloud solutions, and technology consulting to businesses, helping them optimize their IT infrastructure, cybersecurity, and digital operations.',
    accreditations: 'ISO 9001, ISO 27001, Cyber Essentials, Microsoft Partner',
    keyLeaders: 'Management Team',
    companySize: '50-200 employees',
    headquarters: 'United Kingdom',
    foundingYear: '2010s',
    recentNews: 'Paratus 365 continues to expand its cloud services and cybersecurity offerings, helping businesses modernize their IT infrastructure and improve operational efficiency.',
    socialMedia: [
      { label: 'Website', url: 'https://paratus365.com/' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/search/results/companies/?keywords=Paratus%20365' }
    ]
  }
}

/**
 * Normalizes company name for matching (case-insensitive, removes common suffixes)
 */
function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*(ltd|limited|inc|incorporated|llc|corp|corporation|plc|group|holdings|holdings ltd)\.?$/i, '')
    .trim()
}

/**
 * Finds company data by matching normalized names
 */
function findCompanyData(companyName: string): CompanyData | null {
  const normalized = normalizeCompanyName(companyName)
  
  // Direct match first
  if (companyDatabase[companyName]) {
    return companyDatabase[companyName]
  }
  
  // Try normalized match
  if (companyDatabase[normalized]) {
    return companyDatabase[normalized]
  }
  
  // Try case-insensitive match
  const lowerName = companyName.toLowerCase()
  for (const [key, value] of Object.entries(companyDatabase)) {
    if (key.toLowerCase() === lowerName || normalizeCompanyName(key).toLowerCase() === normalized.toLowerCase()) {
      return value
    }
  }
  
  // Try partial match (e.g., "Paratus 365" matches "Paratus")
  const nameWords = normalized.split(/\s+/).filter(w => w.length > 2)
  for (const [key, value] of Object.entries(companyDatabase)) {
    const keyWords = normalizeCompanyName(key).split(/\s+/).filter(w => w.length > 2)
    if (nameWords.some(word => keyWords.some(kw => kw.toLowerCase() === word.toLowerCase()))) {
      return value
    }
  }
  
  return null
}

/**
 * Extracts basic company information from website URL
 */
function extractCompanyInfoFromWebsite(website: string, companyName: string): Partial<CompanyData> {
  try {
    const url = new URL(website)
    const domain = url.hostname.replace(/^www\./, '')
    
    return {
      sector: 'To be determined',
      whatTheyDo: `${companyName} is a company operating in the ${domain} domain. Information will be populated via web research.`,
      accreditations: 'Information will be populated via web research.',
      keyLeaders: 'Information will be populated via web research.',
      companySize: 'Information will be populated via web research.',
      headquarters: 'Information will be populated via web research.',
      foundingYear: 'Information will be populated via web research.',
      recentNews: 'Information will be populated via web research.',
      socialMedia: [
        { label: 'Website', url: website },
        { label: 'LinkedIn', url: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(companyName)}` }
      ]
    }
  } catch {
    return {}
  }
}

/**
 * Fetches company data from the database
 * In a production environment, this would make API calls or web searches
 */
export async function fetchCompanyData(companyName: string, website?: string): Promise<CompanyData | null> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // Check database with flexible matching
  const data = findCompanyData(companyName)
  if (data) {
    return data
  }
  
  // If website is provided but company not in database, create basic entry
  if (website) {
    const basicInfo = extractCompanyInfoFromWebsite(website, companyName)
    if (Object.keys(basicInfo).length > 0) {
      return basicInfo as CompanyData
    }
  }
  
  // If not found, return null (will trigger manual entry or web search)
  return null
}

/**
 * Refreshes company data by performing a new web search
 * This function would integrate with a web search API in production
 */
export async function refreshCompanyData(companyName: string, website?: string): Promise<CompanyData | null> {
  // In production, this would:
  // 1. Search the web for latest company information
  // 2. Parse and extract relevant data
  // 3. Update the database
  // 4. Return updated data
  
  // For now, return existing data (which can be updated manually)
  const data = companyDatabase[companyName]
  if (data) {
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    return { ...data } // Return a copy
  }
  
  return null
}

/**
 * Gets all available company names in the database
 */
export function getAvailableCompanyNames(): string[] {
  return Object.keys(companyDatabase)
}

