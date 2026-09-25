/**
 * PCEA St. Andrew's Church - Promotional Campaign Email Generator
 * Produces modern, responsive, high-fidelity HTML email templates
 * compatible across all email clients (Gmail, Outlook, iOS Mail, Webmail).
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
    scriptureVerse: "Let us rise up and build. So they strengthened their hands for this good work.",
    scriptureReference: "Nehemiah 2:18",
    ctaText: "Support Harambee Online",
    ctaUrl: "https://pceastandrews.org"
  },
  {
    id: "easter-festival",
    title: "Easter Celebration & Resurrection Praise Festival",
    category: "SPECIAL_SERVICE" as const,
    subject: "✝️ Celebrate With Us: Resurrection Sunday Festival of Praise",
    preheader: "He is risen! Come rejoice with the St. Andrew's community in worship and communion.",
    badgeText: "HOLY WEEK & EASTER",
    headline: "Resurrection Sunday & Festival of Praise",
    bodyContent: `Beloved St. Andrew's Family,\n\nWe rejoice together in the blessed hope of the Resurrection! You and your loved ones are cordially invited to our Easter Festival of Praise and Holy Communion.\n\nFeaturing uplifting presentations by the Cathedral Choir, Praise Team, and Church School children, this sacred gathering will commemorate the triumph of the Cross and inspire our walk in newness of life.\n\nBring a friend, family member, or neighbour to celebrate this glorious occasion with us. Refreshments will be served after the service on the church grounds.`,
    bannerImageUrl: "/campaign-banners/easter-celebration.svg",
    bannerImageAlt: "Resurrection Sunday Banner",
    eventDate: "Sunday, April 5, 2026",
    eventTime: "08:00 AM, 10:00 AM & 12:00 PM EAT",
    eventVenue: "PCEA St. Andrew's Church Grounds",
    scriptureVerse: "He is not here; he has risen, just as he said. Come and see the place where he lay.",
    scriptureReference: "Matthew 28:6",
    ctaText: "View Easter Program",
    ctaUrl: "https://pceastandrews.org"
  },
  {
    id: "youth-mission-2026",
    title: "NextGen Youth & Young Adults Mission Conference",
    category: "YOUTH" as const,
    subject: "🔥 NextGen 2026: Youth & Young Adults Leadership & Mission Summit",
    preheader: "Discover your calling, deepen your faith, and connect with peers across Kenya.",
    badgeText: "YOUTH & MISSIONS",
    headline: "NextGen Youth Conference & Evangelism Mission",
    bodyContent: `Calling all youth, teens, university students, and young professionals!\n\nThe PCEA St. Andrew's Youth Ministry invites you to the 2026 NextGen Summit. Under the theme 'Rooted & Unshakable', this 3-day conference will feature dynamic worship sessions, vocational leadership panels, mental health mentorship, and local missions outreach.\n\nCome fellowship, learn, and be empowered to lead with biblical integrity in your career, university, and community.`,
    bannerImageUrl: "/campaign-banners/youth-mission.svg",
    bannerImageAlt: "Youth Mission Banner",
    eventDate: "August 20 - 22, 2026",
    eventTime: "09:00 AM - 04:30 PM Daily",
    eventVenue: "St. Andrew's Multipurpose Hall",
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
 * Builds the complete, robust HTML email string for promotional broadcasts.
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

  const category = campaign.category || "ANNOUNCEMENT";
  const badgeColors = getCategoryBadgeColor(category);
  const badgeLabel = campaign.badgeText || category.replace(/_/g, " ");

  const headline = campaign.headline || campaign.title || "Special Church Announcement";
  const subject = campaign.subject || "PCEA St. Andrew's Official Communication";
  const preheader = campaign.preheader || "Official campaign communication from PCEA St. Andrew's Church";
  const creatorName = campaign.creatorName || "STANDS Church Administration";

  // Format body text with paragraphs
  const rawBody = campaign.bodyContent || "";
  const formattedParagraphs = rawBody
    .split(/\n\n+/)
    .map(p => {
      const trimmed = p.trim();
      if (!trimmed) return "";
      return `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.65; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .filter(Boolean)
    .join("\n");

  // Hero Banner handling
  let bannerHtml = "";
  if (campaign.bannerImageUrl) {
    bannerHtml = `
      <!-- Banner Image -->
      <tr>
        <td style="padding: 0; background-color: #0f172a; text-align: center; overflow: hidden; border-top-left-radius: 12px; border-top-right-radius: 12px;">
          <img 
            src="${campaign.bannerImageUrl}" 
            alt="${campaign.bannerImageAlt || headline}" 
            style="width: 100%; max-width: 600px; height: auto; display: block; margin: 0 auto; border: 0; outline: none; object-fit: cover;" 
          />
        </td>
      </tr>
    `;
  }

  // Scripture Box
  let scriptureHtml = "";
  if (campaign.scriptureVerse) {
    scriptureHtml = `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #d97706; border-radius: 8px;">
        <tr>
          <td style="padding: 16px 20px;">
            <p style="margin: 0; font-family: Georgia, Cambria, 'Times New Roman', Times, serif; font-style: italic; font-size: 15px; line-height: 1.6; color: #78350f;">
              &ldquo;${campaign.scriptureVerse}&rdquo;
            </p>
            ${campaign.scriptureReference ? `
              <p style="margin: 8px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.05em;">
                — ${campaign.scriptureReference}
              </p>
            ` : ""}
          </td>
        </tr>
      </table>
    `;
  }

  // Event & Highlights Card
  const hasDetails = Boolean(campaign.eventDate || campaign.eventVenue || campaign.targetAmount);
  let detailsCardHtml = "";
  if (hasDetails) {
    detailsCardHtml = `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <tr>
          <td style="padding: 16px 20px; background-color: #1e3a8a; border-bottom: 2px solid #d97706;">
            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.15em;">
              📌 CAMPAIGN &amp; EVENT PARTICULARS
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              ${campaign.eventDate ? `
                <tr>
                  <td width="30" valign="top" style="padding-bottom: 12px; font-size: 16px;">📅</td>
                  <td style="padding-bottom: 12px;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; font-family: sans-serif;">Date &amp; Schedule</div>
                    <div style="font-size: 14px; font-weight: 600; color: #0f172a; font-family: sans-serif;">${campaign.eventDate} ${campaign.eventTime ? `&bull; ${campaign.eventTime}` : ""}</div>
                  </td>
                </tr>
              ` : ""}
              ${campaign.eventVenue ? `
                <tr>
                  <td width="30" valign="top" style="padding-bottom: 12px; font-size: 16px;">📍</td>
                  <td style="padding-bottom: 12px;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; font-family: sans-serif;">Location / Venue</div>
                    <div style="font-size: 14px; font-weight: 600; color: #0f172a; font-family: sans-serif;">${campaign.eventVenue}</div>
                  </td>
                </tr>
              ` : ""}
              ${campaign.targetAmount ? `
                <tr>
                  <td width="30" valign="top" style="font-size: 16px;">🎯</td>
                  <td>
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; font-family: sans-serif;">Target Budget / Goal</div>
                    <div style="font-size: 16px; font-weight: 800; color: #d97706; font-family: sans-serif;">KES ${Number(campaign.targetAmount).toLocaleString()}</div>
                  </td>
                </tr>
              ` : ""}
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  // CTA Button
  let ctaHtml = "";
  if (campaign.ctaText) {
    const ctaUrl = campaign.ctaUrl || "https://pceastandrews.org";
    ctaHtml = `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0 20px 0;">
        <tr>
          <td align="center">
            <a 
              href="${ctaUrl}" 
              target="_blank" 
              style="display: inline-block; background-color: #1e3a8a; background-image: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); color: #ffffff; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.08em; box-shadow: 0 4px 12px rgba(30, 58, 138, 0.25); border: 1px solid #1e3a8a;"
            >
              ${campaign.ctaText} &rarr;
            </a>
          </td>
        </tr>
      </table>
    `;
  }

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style type="text/css">
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f1f5f9; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    p { display: block; margin: 0 0 16px 0; }
    a { color: #1e3a8a; text-decoration: underline; }
    @media only screen and (max-width: 620px) {
      .responsive-table { width: 100% !important; }
      .mobile-padding { padding-left: 20px !important; padding-right: 20px !important; }
      .headline-text { font-size: 22px !important; line-height: 28px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <!-- Preheader text (hidden in display, shows in client inbox snippet) -->
  <div style="display: none; font-size: 1px; color: #f1f5f9; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${preheader}
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 24px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" class="responsive-table" style="max-width: 600px; background-color: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.06); overflow: hidden;">
          
          <!-- Top Header Strip: PCEA St. Andrew's Branding -->
          <tr>
            <td style="background-color: #0f172a; padding: 16px 24px; border-bottom: 2px solid #fbbf24;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="36" valign="middle">
                    <img src="https://accounts.pceastandrews.org/pcea.svg" alt="PCEA St Andrew's" width="32" height="32" style="display: block; border-radius: 6px;" onerror="this.style.display='none'" />
                  </td>
                  <td valign="middle" style="padding-left: 12px;">
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 900; color: #ffffff; letter-spacing: 0.1em; text-transform: uppercase;">
                      PCEA St. Andrew's Church
                    </div>
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 700; color: #fbbf24; letter-spacing: 0.15em; text-transform: uppercase;">
                      E-Requisitions Portal &bull; Official Broadcast
                    </div>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; background-color: rgba(251, 191, 36, 0.15); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 4px 10px; font-family: monospace; font-size: 10px; font-weight: 700; color: #fbbf24;">
                      PROMOTION
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${bannerHtml}

          <!-- Main Content Area -->
          <tr>
            <td class="mobile-padding" style="padding: 32px 32px 24px 32px; background-color: #ffffff;">
              
              <!-- Badge -->
              <div style="margin-bottom: 14px;">
                <span style="display: inline-block; background-color: ${badgeColors.bg}; color: ${badgeColors.text}; border: 1px solid ${badgeColors.border}; border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  ${badgeLabel}
                </span>
              </div>

              <!-- Headline -->
              <h1 class="headline-text" style="margin: 0 0 18px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 26px; font-weight: 900; color: #0f172a; line-height: 1.3; letter-spacing: -0.02em;">
                ${headline}
              </h1>

              ${scriptureHtml}

              <!-- Body Copy -->
              <div style="margin-top: 16px;">
                ${formattedParagraphs}
              </div>

              ${detailsCardHtml}

              ${ctaHtml}

              <!-- Divider -->
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;" />

              <!-- Sender Attribution Note -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="font-size: 12px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5;">
                    Dispatched on behalf of: <strong style="color: #0f172a;">${creatorName}</strong><br />
                    Recipient Address: <code style="font-family: monospace; font-size: 11px; color: #1e3a8a;">${recipientEmail}</code>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Official Church Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.1em;">
                Presbyterian Church of East Africa &bull; St. Andrew's Parish
              </p>
              <p style="margin: 0 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: #64748b; line-height: 1.5;">
                State House Road / Nyerere Road, P.O. Box 41282 - 00100 Nairobi, Kenya<br />
                Telephone: +254 20 2723040 / +254 722 208556 &bull; Email: ict.team@pceastandrews.org
              </p>
              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} PCEA St. Andrew's Church. All rights reserved. &bull; STANDS eRequisitions System
              </p>
            </td>
          </tr>

        </table>

        <!-- Unsubscribe / Preferences Note -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin-top: 14px;">
          <tr>
            <td align="center" style="font-size: 11px; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.4;">
              This notification is an official church communication. If you received this email in error, please notify our ICT secretariat.
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}
