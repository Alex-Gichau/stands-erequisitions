/**
 * PCEA St. Andrew's Church - Promotional Campaign Email Generator
 * Produces clean, modern, responsive HTML email templates
 * matching the Universe / Minimalist style reference.
 */

import { CampaignPromotion } from "../types";

export interface CampaignHtmlOptions {
  recipientEmail?: string;
  recipientName?: string;
  previewMode?: boolean;
}

export const PRESET_BANNERS = [
  {
    id: "harambee",
    name: "Annual Harambee & Development Fund",
    url: "/campaign-banners/harambee-drive.svg",
    category: "FUNDRAISING",
    accentColor: "#d97706"
  },
  {
    id: "easter",
    name: "Easter & Resurrection Festival",
    url: "/campaign-banners/easter-celebration.svg",
    category: "SPECIAL_SERVICE",
    accentColor: "#7c3aed"
  },
  {
    id: "youth",
    name: "Youth & Evangelism Mission",
    url: "/campaign-banners/youth-mission.svg",
    category: "YOUTH",
    accentColor: "#0d9488"
  },
  {
    id: "stewardship",
    name: "Christian Stewardship & Tithes",
    url: "/campaign-banners/stewardship-tithe.svg",
    category: "STEWARDSHIP",
    accentColor: "#059669"
  }
];

export const PRESET_CAMPAIGN_TEMPLATES = [
  {
    id: "harambee-2026",
    title: "Phase II Sanctuary Expansion & Development Harambee",
    category: "FUNDRAISING" as const,
    subject: "🏛️ Special Appeal: Annual Harvest & Building Development Harambee 2026",
    preheader: "Join hands with St. Andrew's Church as we expand God's house for future generations.",
    badgeText: "SPECIAL HARAMBEE DRIVE",
    headline: "Annual Harvest & Building Development Fund Drive",
    bodyContent: `Dear Members and Friends of PCEA St. Andrew's Church,\n\nGrace and peace to you in the name of our Lord and Saviour Jesus Christ.\n\nWe warmly invite all congregation members, ministry groups, and partners to our upcoming Annual Harvest and Building Development Harambee. Through your steadfast generosity and prayers, our parish continues to be a vibrant beacon of faith, worship, and compassionate outreach across Nairobi and beyond.\n\nThis year, our collective focus is directed towards the Phase II Sanctuary Renovation, Youth Complex modernization, and community benevolent outreach programs.\n\nEvery gift, large or small, advances this divine calling. You can give conveniently via M-Pesa Paybill, bank deposit, or in person during Sunday services.\n\nMay the Lord bless you abundantly as you prayerfully consider your commitment.`,
    bannerImageUrl: "/campaign-banners/harambee-drive.svg",
    bannerImageAlt: "PCEA St Andrews Harambee Banner",
    eventDate: "Sunday, October 18, 2026",
    eventTime: "09:30 AM & 11:30 AM EAT",
    eventVenue: "Main Sanctuary & Live Virtual Broadcast",
    targetAmount: 5000000,
    scriptureVerse: "Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.",
    scriptureReference: "2 Corinthians 9:7",
    ctaText: "Contribute to Harambee Fund",
    ctaUrl: "https://accounts.pceastandrews.org"
  },
  {
    id: "easter-festival-2026",
    title: "Easter & Resurrection Praise Weekend 2026",
    category: "SPECIAL_SERVICE" as const,
    subject: "✝️ Celebrate Easter: He is Risen! Special Services & Cantata Schedule",
    preheader: "Join us for Maundy Thursday, Good Friday, and the Glorious Resurrection Sunday Services.",
    badgeText: "HOLY WEEK & EASTER",
    headline: "Easter Praise & Resurrection Celebration 2026",
    bodyContent: `Beloved Family in Christ,\n\nWe invite you to gather with us for our special Easter Services and Resurrection Cantata. Come experience choral anthems, fellowship, and the living hope of the risen Lord.\n\nBring your family, friends, and neighbors as we worship together in spirit and truth across all parish services.`,
    bannerImageUrl: "/campaign-banners/easter-celebration.svg",
    bannerImageAlt: "Easter Celebration Banner",
    eventDate: "April 3 - April 5, 2026",
    eventTime: "07:30 AM, 09:30 AM & 11:30 AM",
    eventVenue: "PCEA St. Andrew's Church Sanctuary",
    scriptureVerse: "Praise be to the God and Father of our Lord Jesus Christ! In his great mercy he has given us new birth into a living hope through the resurrection of Jesus Christ from the dead.",
    scriptureReference: "1 Peter 1:3",
    ctaText: "View Easter Schedule",
    ctaUrl: "https://pceastandrews.org"
  },
  {
    id: "youth-conference-2026",
    title: "Youth Ignited: National Evangelism & Leadership Summit",
    category: "YOUTH" as const,
    subject: "🔥 Youth Ignited 2026: Faith, Purpose & Leadership Conference",
    preheader: "Calling all high school and university students, young adults, and teens for 3 days of worship and empowerment.",
    badgeText: "YOUTH MINISTRY",
    headline: "Youth Ignited: National Leadership Summit 2026",
    bodyContent: `Hey Young People!\n\nThe St. Andrew's Youth & Teens Ministry is thrilled to host the 2026 Leadership Summit under the theme 'Unashamed & Purpose-Driven'.\n\nEnjoy interactive workshops, worship nights, career panels, and sports mentorship with seasoned Christian leaders.`,
    bannerImageUrl: "/campaign-banners/youth-mission.svg",
    bannerImageAlt: "Youth Mission Banner",
    eventDate: "August 20 - 22, 2026",
    eventTime: "09:00 AM - 04:30 PM Daily",
    eventVenue: "Youth Multi-Purpose Hall & Grounds",
    targetAmount: 350000,
    scriptureVerse: "Don't let anyone look down on you because you are young, but set an example for the believers in speech, in conduct, in love, in faith and in purity.",
    scriptureReference: "1 Timothy 4:12",
    ctaText: "Register for Youth Conference",
    ctaUrl: "https://pceastandrews.org"
  },
  {
    id: "stewardship-commitment",
    title: "Annual Christian Stewardship & Ministry Dedication Week",
    category: "STEWARDSHIP" as const,
    subject: "📖 Walking in Faith: Christian Stewardship & Tithe Dedication",
    preheader: "Reflecting on our covenant of faithful giving, time, talent, and treasure.",
    badgeText: "FINANCIAL STEWARDSHIP",
    headline: "Christian Stewardship & Tithes Dedication Week",
    bodyContent: `Dear Church Members and Leaders,\n\nScripture reminds us that all that we have comes from God, and of His own do we give back to Him (1 Chronicles 29:14).\n\nAs we embark on our Annual Stewardship Week, we invite every member to reflect on our individual and family covenant with God. Our transparent financial requisition system and ledger books ensure that every cent given is faithfully directed to kingdom work, church group ministries, and welfare programs.\n\nJoin us this Sunday as we dedicate our pledge envelopes and pray over our collective stewardship for the upcoming financial year.`,
    bannerImageUrl: "/campaign-banners/stewardship-tithe.svg",
    bannerImageAlt: "Christian Stewardship Banner",
    eventDate: "Sunday, July 12, 2026",
    eventTime: "All Sunday Services",
    eventVenue: "PCEA St. Andrew's Church",
    scriptureVerse: "Bring the whole tithe into the storehouse, that there may be food in my house. Test me in this, says the Lord Almighty, and see if I will not throw open the floodgates of heaven.",
    scriptureReference: "Malachi 3:10",
    ctaText: "Learn About Church Stewardship",
    ctaUrl: "https://pceastandrews.org"
  }
];

export function getCategoryBadgeColor(category: string): { bg: string; text: string; border: string } {
  switch (category) {
    case "FUNDRAISING":
      return { bg: "#fef3c7", text: "#b45309", border: "#fde68a" };
    case "SPECIAL_SERVICE":
      return { bg: "#ede9fe", text: "#6d28d9", border: "#ddd6fe" };
    case "EVENT":
      return { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" };
    case "YOUTH":
      return { bg: "#ccfbf1", text: "#0f766e", border: "#99f6e4" };
    case "STEWARDSHIP":
      return { bg: "#d1fae5", text: "#047857", border: "#a7f3d0" };
    case "FELLOWSHIP":
      return { bg: "#fce7f3", text: "#be185d", border: "#fbcfe8" };
    default:
      return { bg: "#f1f5f9", text: "#334155", border: "#e2e8f0" };
  }
}

/**
 * Builds the complete, robust HTML email string for promotional broadcasts
 * matching the clean Universe / Minimalist style reference with waving hand graphic.
 */
export function buildCampaignEmailHtml(
  campaign: Partial<CampaignPromotion>,
  options: CampaignHtmlOptions = {}
): string {
  const {
    recipientEmail = "member@pceastandrews.org",
    recipientName = "Church Member",
    previewMode = false
  } = options;

  const headline = campaign.headline || campaign.title || "Special Church Announcement";
  const subject = campaign.subject || "PCEA St. Andrew's Official Communication";
  const preheader = campaign.preheader || "Official campaign communication from PCEA St. Andrew's Church";
  const ctaUrl = campaign.ctaUrl || "https://accounts.pceastandrews.org";
  const ctaText = campaign.ctaText || "Participate in event";

  // Extract clean paragraphs
  const rawBody = campaign.bodyContent || "";
  const paragraphs = rawBody
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(Boolean);

  const formattedParagraphs = paragraphs.length > 0
    ? paragraphs.map(p => `
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #4b5563; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center;">
          ${p.replace(/\n/g, '<br />')}
        </p>
      `).join("\n")
    : `<p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #4b5563; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center;">We are glad to have you join our upcoming church initiative and community mission.</p>`;

  // Highlights or details
  const hasDetails = Boolean(campaign.eventDate || campaign.eventVenue || campaign.targetAmount);

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 40px 16px; background-color: #f6f8fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #111827;">
  <!-- Preheader text -->
  <div style="display: none; font-size: 1px; color: #f6f8fa; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${preheader}
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center">
        <!-- Top Wordmark -->
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 26px; font-weight: 900; color: #94a3b8; letter-spacing: -0.5px; text-transform: lowercase;">
            stands
          </div>
        </div>

        <!-- Main Card Container -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; background-color: #ffffff; border-radius: 14px; border: 1px solid #e5e7eb; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04); overflow: hidden; box-sizing: border-box;">
          <tr>
            <td style="padding: 40px 36px 32px 36px; text-align: center;">
              
              <!-- Waving Hand with Confetti Graphic (Matching Reference) -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <svg width="130" height="130" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
                      <!-- Soft Circle Disc -->
                      <circle cx="80" cy="80" r="60" fill="#F4F5F7" />
                      <!-- Confetti Sprinkles -->
                      <rect x="36" y="38" width="6" height="6" rx="1.5" transform="rotate(15 36 38)" fill="#4361EE" />
                      <rect x="124" y="42" width="5" height="5" rx="1" transform="rotate(-20 124 42)" fill="#3B82F6" />
                      <rect x="30" y="76" width="5" height="5" rx="1" fill="#F59E0B" />
                      <rect x="130" y="80" width="5" height="5" rx="1" transform="rotate(25 130 80)" fill="#F43F5E" />
                      <rect x="44" y="112" width="4" height="4" rx="1" fill="#10B981" />
                      <rect x="120" y="110" width="5" height="5" rx="1" fill="#F59E0B" />
                      <!-- Sparkles & Dots -->
                      <path d="M38 56L35 59L38 62L41 59L38 56Z" fill="#10B981" />
                      <path d="M118 36L116 38.5L118 41L120 38.5L118 36Z" fill="#F43F5E" />
                      <circle cx="50" cy="98" r="2" fill="#4361EE" />
                      <circle cx="126" cy="62" r="2" fill="#4361EE" />
                      <!-- Motion indicators -->
                      <path d="M102 48C104 50 105 53 105 56" stroke="#94A3B8" stroke-width="1.8" stroke-linecap="round" />
                      <path d="M72 72C70 74 69 76 69 78" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" />
                      <!-- Navy Cuff -->
                      <path d="M68 124C68 116 74 110 84 108L98 114C104 118 106 124 105 132L68 124Z" fill="#334155" />
                      <!-- Waving Hand -->
                      <path d="M74 72L74 54C74 50.7 76.7 48 80 48C83.3 48 86 50.7 86 54L86 64C86 64 88.5 49 92 49C95.5 49 98 51.5 98 55L98 68C98 68 100.5 56 104 56C107.5 56 110 58.5 110 62L110 82C110 94 102 106 88 108C76 108 70 98 70 88L70 82C66 81 64 77 66 73C68 69 72 70 74 72Z" fill="#EA8C55" />
                      <path d="M75 74C74 73 72 73 70.5 74.5C69 76 69.5 78 71.5 79L76 82" stroke="#D97706" stroke-width="1.2" stroke-linecap="round" />
                      <path d="M86 66L86 78" stroke="#D97706" stroke-width="1.2" stroke-linecap="round" />
                      <path d="M98 70L98 80" stroke="#D97706" stroke-width="1.2" stroke-linecap="round" />
                    </svg>
                  </td>
                </tr>
              </table>

              <!-- Main Greeting Headline -->
              <h1 style="font-size: 22px; font-weight: 800; color: #111827; margin: 0 0 16px 0; line-height: 1.35; letter-spacing: -0.3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Welcome to ${headline},<br />${recipientName}!
              </h1>

              <!-- Body Paragraphs -->
              <div style="margin-bottom: 28px;">
                ${formattedParagraphs}
              </div>

              <!-- Primary Blue CTA Button -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 13px 32px; border-radius: 8px; font-weight: 700; font-size: 14px; text-decoration: none; text-align: center; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Secondary Callout -->
              <div style="text-align: center; border-top: 1px solid #f3f4f6; padding-top: 24px;">
                <h3 style="font-size: 15px; font-weight: 700; color: #111827; margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  Looking to attend an event?
                </h3>
                <p style="font-size: 13px; color: #4b5563; line-height: 1.5; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  Use STANDS to <a href="${ctaUrl}" style="color: #4361ee; text-decoration: none; font-weight: 600;">discover events</a> happening near you.
                </p>
                ${hasDetails ? `
                  <div style="margin-top: 12px; font-size: 12px; color: #6b7280; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    ${campaign.eventDate ? `📅 <strong>${campaign.eventDate}</strong> ` : ""}
                    ${campaign.eventVenue ? `&bull; 📍 ${campaign.eventVenue}` : ""}
                  </div>
                ` : ""}
              </div>

            </td>
          </tr>

          <!-- Bottom Have Questions Card Footer -->
          <tr>
            <td style="background-color: #f9fafb; border-top: 1px solid #f3f4f6; padding: 24px 32px; text-align: center;">
              <h4 style="font-size: 15px; font-weight: 800; color: #111827; margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Have questions?
              </h4>
              <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                We are here to help, learn more about STANDS <a href="${ctaUrl}/#help" style="color: #4361ee; text-decoration: none; font-weight: 600;">here</a> or <a href="mailto:ict.team@pceastandrews.org" style="color: #4361ee; text-decoration: none; font-weight: 600;">contact us</a>
              </p>
            </td>
          </tr>
        </table>

        <!-- Navigation Links Below Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; margin-top: 22px;">
          <tr>
            <td align="center" style="font-size: 13px; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <a href="${ctaUrl}/#login" style="color: #4361ee; text-decoration: none; margin: 0 10px;">Log in</a>
              <span style="color: #cbd5e1;">&bull;</span>
              <a href="${ctaUrl}/#how-it-works" style="color: #4361ee; text-decoration: none; margin: 0 10px;">How it works</a>
              <span style="color: #cbd5e1;">&bull;</span>
              <a href="${ctaUrl}/#help" style="color: #4361ee; text-decoration: none; margin: 0 10px;">Get help</a>
            </td>
          </tr>
        </table>

        <!-- Footer Notice Below Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; margin-top: 16px;">
          <tr>
            <td align="center" style="font-size: 11px; color: #9ca3af; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              Made with ❤️ in Nairobi<br />
              PCEA St. Andrew's Church, State House Road / Nyerere Road, Nairobi, Kenya<br />
              &copy; ${new Date().getFullYear()} STANDS.com &bull; 
              <a href="${ctaUrl}/#settings" style="color: #4361ee; text-decoration: none;">Manage Preferences</a> &bull; 
              <a href="${ctaUrl}/#unsubscribe" style="color: #4361ee; text-decoration: none;">Unsubscribe</a>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}
