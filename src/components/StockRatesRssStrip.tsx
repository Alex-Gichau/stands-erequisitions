/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Rss, ArrowUpRight, ArrowDownRight, ExternalLink, Activity, Info, ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

export interface StockRateItem {
  symbol: string;
  name: string;
  price: string;
  currency: string;
  change: string;
  percentChange: number;
  direction: "up" | "down" | "flat";
  dayHigh?: string;
  dayLow?: string;
  volume?: string;
  marketCap?: string;
  rssHeadline?: string;
  rssLink?: string;
  rssPubDate?: string;
}

const DEFAULT_STOCKS: StockRateItem[] = [
  {
    symbol: "NSE 20",
    name: "Nairobi Securities Exchange 20 Share Index",
    price: "1,745.20",
    currency: "PTS",
    change: "+8.35",
    percentChange: 0.48,
    direction: "up",
    dayHigh: "1,748.50",
    dayLow: "1,739.10",
    volume: "14.2M",
    rssHeadline: "NSE 20 Index gains 0.48% as banking sector posts strong Q3 earnings",
    rssLink: "https://www.nse.co.ke",
  },
  {
    symbol: "SCOM",
    name: "Safaricom Plc",
    price: "17.85",
    currency: "KES",
    change: "+0.25",
    percentChange: 1.42,
    direction: "up",
    dayHigh: "18.00",
    dayLow: "17.60",
    volume: "8.4M",
    marketCap: "KES 715.1B",
    rssHeadline: "Safaricom M-Pesa transaction volumes surge 18% year-on-year",
    rssLink: "https://www.safaricom.co.ke",
  },
  {
    symbol: "EQTY",
    name: "Equity Group Holdings",
    price: "48.20",
    currency: "KES",
    change: "+0.40",
    percentChange: 0.84,
    direction: "up",
    dayHigh: "48.50",
    dayLow: "47.75",
    volume: "3.2M",
    marketCap: "KES 181.9B",
    rssHeadline: "Equity Group expands regional footprint with digital banking push",
    rssLink: "https://equitygroupholdings.com",
  },
  {
    symbol: "KCB",
    name: "KCB Group Plc",
    price: "32.50",
    currency: "KES",
    change: "-0.20",
    percentChange: -0.61,
    direction: "down",
    dayHigh: "33.10",
    dayLow: "32.40",
    volume: "2.1M",
    marketCap: "KES 104.4B",
    rssHeadline: "KCB Group reports robust dividend yield following SME loan expansion",
    rssLink: "https://kcbgroup.com",
  },
  {
    symbol: "EABL",
    name: "East African Breweries Ltd",
    price: "145.00",
    currency: "KES",
    change: "+3.00",
    percentChange: 2.11,
    direction: "up",
    dayHigh: "146.50",
    dayLow: "142.00",
    volume: "950K",
    marketCap: "KES 114.6B",
    rssHeadline: "EABL premium spirits portfolio drives export volume in East Africa",
    rssLink: "https://www.eabl.com",
  },
  {
    symbol: "USD/KES",
    name: "US Dollar to Kenya Shilling",
    price: "128.85",
    currency: "KES",
    change: "-0.26",
    percentChange: -0.20,
    direction: "down",
    dayHigh: "129.40",
    dayLow: "128.50",
    rssHeadline: "CBK Forex Reserve buffer holds firm amidst agricultural export inflows",
    rssLink: "https://www.centralbank.go.ke",
  },
  {
    symbol: "NCBA",
    name: "NCBA Group Plc",
    price: "42.10",
    currency: "KES",
    change: "+0.10",
    percentChange: 0.24,
    direction: "up",
    dayHigh: "42.50",
    dayLow: "41.80",
    volume: "1.4M",
    marketCap: "KES 69.3B",
    rssHeadline: "NCBA asset finance division maintains lead in commercial vehicle funding",
  },
  {
    symbol: "COOP",
    name: "Co-operative Bank of Kenya",
    price: "13.05",
    currency: "KES",
    change: "+0.05",
    percentChange: 0.38,
    direction: "up",
    dayHigh: "13.20",
    dayLow: "12.95",
    volume: "1.8M",
    marketCap: "KES 76.5B",
    rssHeadline: "Co-op Bank Kingdom Securities notes steady institutional buying",
  },
  {
    symbol: "EUR/KES",
    name: "Euro to Kenya Shilling",
    price: "142.10",
    currency: "KES",
    change: "+0.21",
    percentChange: 0.15,
    direction: "up",
    dayHigh: "142.60",
    dayLow: "141.80",
  },
  {
    symbol: "GBP/KES",
    name: "British Pound to Kenya Shilling",
    price: "168.45",
    currency: "KES",
    change: "+0.54",
    percentChange: 0.32,
    direction: "up",
    dayHigh: "169.10",
    dayLow: "167.90",
  },
  {
    symbol: "GOLD",
    name: "Spot Gold Index",
    price: "2,492.30",
    currency: "USD/oz",
    change: "+13.60",
    percentChange: 0.55,
    direction: "up",
    dayHigh: "2,498.00",
    dayLow: "2,480.10",
    rssHeadline: "Global gold prices rally on central bank reserve accumulation trends",
  },
  {
    symbol: "BRENT",
    name: "Brent Crude Oil",
    price: "78.10",
    currency: "USD/bbl",
    change: "-0.67",
    percentChange: -0.85,
    direction: "down",
    dayHigh: "79.20",
    dayLow: "77.80",
    rssHeadline: "Global crude oil futures stabilize amid OPEC+ production targets",
  },
];

// Business & financial RSS feed endpoints to poll
const RSS_FEED_URLS = [
  "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.businessdailyafrica.com%2Fbd%2Fnews%2Frss.xml",
  "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.finance.yahoo.com%2Frss%2F2.0%2Fheadline%3Fs%3D%5ENSEI%26region%3DUS%26lang%3Den-US",
];

export const StockRatesRssStrip: React.FC = () => {
  const [stocks, setStocks] = useState<StockRateItem[]>(DEFAULT_STOCKS);
  const [isPaused, setIsPaused] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockRateItem | null>(null);
  const [rssArticles, setRssArticles] = useState<{ title: string; link: string; pubDate: string }[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  // Fetch external RSS news items
  const fetchRssFeeds = async () => {
    setIsRefreshing(true);
    try {
      const allArticles: { title: string; link: string; pubDate: string }[] = [];
      
      for (const url of RSS_FEED_URLS) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data?.items && Array.isArray(data.items)) {
              data.items.slice(0, 5).forEach((item: any) => {
                allArticles.push({
                  title: item.title,
                  link: item.link || item.guid,
                  pubDate: item.pubDate ? new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                });
              });
            }
          }
        } catch (e) {
          // Ignore individual CORS/network failures
        }
      }

      if (allArticles.length > 0) {
        setRssArticles(allArticles);
        // Merge headlines into stock items if applicable
        setStocks((prev) =>
          prev.map((s, idx) => {
            const matchingArticle = allArticles[idx % allArticles.length];
            return {
              ...s,
              rssHeadline: matchingArticle ? matchingArticle.title : s.rssHeadline,
              rssLink: matchingArticle ? matchingArticle.link : s.rssLink,
              rssPubDate: matchingArticle ? matchingArticle.pubDate : s.rssPubDate,
            };
          })
        );
      }
    } catch (err) {
      console.warn("RSS Feed fetch fallback:", err);
    } finally {
      setIsRefreshing(false);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  };

  // Live price jitter simulator to mimic dynamic financial market tickers
  useEffect(() => {
    fetchRssFeeds();

    const interval = setInterval(() => {
      setStocks((prevStocks) =>
        prevStocks.map((stock) => {
          // 30% chance to update a stock rate slightly
          if (Math.random() > 0.7) {
            const numPrice = parseFloat(stock.price.replace(/,/g, ""));
            const deltaPercent = (Math.random() - 0.48) * 0.3; // -0.15% to +0.15%
            const newPriceNum = Math.max(0.1, numPrice * (1 + deltaPercent / 100));
            const newPercentChange = Number((stock.percentChange + deltaPercent).toFixed(2));
            const newChangeNum = (newPriceNum - numPrice).toFixed(2);
            const formattedChange = newChangeNum.startsWith("-") ? newChangeNum : `+${newChangeNum}`;
            const direction = newPercentChange > 0 ? "up" : newPercentChange < 0 ? "down" : "flat";

            return {
              ...stock,
              price: newPriceNum < 100 ? newPriceNum.toFixed(2) : newPriceNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              percentChange: newPercentChange,
              change: formattedChange,
              direction,
            };
          }
          return stock;
        })
      );
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  // Duplicate items for continuous smooth looping flow
  const tickerTrack = [...stocks, ...stocks, ...stocks];

  return (
    <div className="w-full relative select-none">
      {/* Outer Strip Container */}
      <div 
        className="w-full rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-900 text-slate-100 shadow-sm overflow-hidden flex items-center h-10 px-1 relative group"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Marquee Ticker Track flowing LEFT TO RIGHT */}
        <div className="flex-1 overflow-hidden h-full flex items-center relative">
          <motion.div
            className="flex items-center gap-6 whitespace-nowrap"
            animate={{
              x: isPaused ? undefined : ["-50%", "0%"], // Flowing LEFT TO RIGHT
            }}
            transition={{
              x: {
                repeat: Infinity,
                repeatType: "loop",
                duration: 120,
                ease: "linear",
              },
            }}
            style={{ display: "flex", width: "max-content" }}
          >
            {tickerTrack.map((item, index) => {
              const isUp = item.direction === "up" || item.percentChange >= 0;
              return (
                <div
                  key={`${item.symbol}-${index}`}
                  onClick={() => setSelectedStock(item)}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl hover:bg-slate-800/80 transition-all cursor-pointer group/item border border-transparent hover:border-slate-700/80"
                >
                  {/* Symbol */}
                  <span className="font-mono font-black text-xs text-white tracking-wide">
                    {item.symbol}
                  </span>

                  {/* Price */}
                  <span className="font-mono text-xs font-semibold text-slate-200">
                    {item.price} <span className="text-[10px] text-slate-400 font-normal">{item.currency}</span>
                  </span>

                  {/* Change Badge */}
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-tight",
                      isUp
                        ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
                        : "bg-rose-950/80 text-rose-400 border border-rose-800/60"
                    )}
                  >
                    {isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    {isUp ? `+${item.percentChange}%` : `${item.percentChange}%`}
                  </span>

                  {/* Optional RSS Headline Teaser */}
                  {item.rssHeadline && (
                    <span className="text-[10px] text-slate-400 truncate max-w-[180px] hidden md:inline font-sans font-medium pl-1 border-l border-slate-800">
                      {item.rssHeadline}
                    </span>
                  )}
                </div>
              );
            })}
          </motion.div>
        </div>

        {/* Right Info Indicator */}
        <div className="z-10 bg-slate-950/90 border-l border-slate-800 px-3 py-1.5 h-full shrink-0 hidden lg:flex items-center gap-2 text-[10px] text-slate-400 font-mono">
          <Activity size={12} className="text-emerald-400" />
          <span>Sync: {lastUpdated}</span>
        </div>
      </div>

      {/* Stock Detail & RSS Headline Modal / Tooltip */}
      <AnimatePresence>
        {selectedStock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full text-slate-100 relative space-y-4"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedStock(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>

              {/* Header */}
              <div className="flex items-start justify-between pr-8">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-800 font-mono text-xs font-black">
                      {selectedStock.symbol}
                    </span>
                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Market Rate</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1">{selectedStock.name}</h3>
                </div>
              </div>

              {/* Price Display */}
              <div className="flex items-baseline gap-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                <span className="text-2xl font-mono font-bold text-white">
                  {selectedStock.price} <span className="text-sm font-normal text-slate-400">{selectedStock.currency}</span>
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold",
                    selectedStock.percentChange >= 0
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : "bg-rose-950 text-rose-400 border border-rose-800"
                  )}
                >
                  {selectedStock.percentChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {selectedStock.change} ({selectedStock.percentChange >= 0 ? `+${selectedStock.percentChange}%` : `${selectedStock.percentChange}%`})
                </span>
              </div>

              {/* Market Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {selectedStock.dayHigh && (
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-800">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Day High</span>
                    <span className="font-mono font-semibold text-slate-200">{selectedStock.dayHigh} {selectedStock.currency}</span>
                  </div>
                )}
                {selectedStock.dayLow && (
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-800">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Day Low</span>
                    <span className="font-mono font-semibold text-slate-200">{selectedStock.dayLow} {selectedStock.currency}</span>
                  </div>
                )}
                {selectedStock.volume && (
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-800">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Trading Volume</span>
                    <span className="font-mono font-semibold text-slate-200">{selectedStock.volume}</span>
                  </div>
                )}
                {selectedStock.marketCap && (
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-800">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Market Cap</span>
                    <span className="font-mono font-semibold text-slate-200">{selectedStock.marketCap}</span>
                  </div>
                )}
              </div>

              {/* RSS Headline Section */}
              {selectedStock.rssHeadline && (
                <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-900/60 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-400 tracking-wider">
                    <Rss size={12} />
                    <span>Associated Financial RSS Bulletin</span>
                  </div>
                  <p className="text-xs text-slate-200 font-medium leading-relaxed">
                    "{selectedStock.rssHeadline}"
                  </p>
                  {selectedStock.rssLink && (
                    <a
                      href={selectedStock.rssLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline mt-1"
                    >
                      <span>Read full report</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedStock(null)}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StockRatesRssStrip;
