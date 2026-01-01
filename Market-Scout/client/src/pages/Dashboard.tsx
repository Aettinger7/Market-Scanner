import { useLatestScans, useRunScan } from "@/hooks/use-scan";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Loader2, RefreshCw, TrendingUp, DollarSign, Activity, BarChart3, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/utils";

// Helper to format currency if not already in utils
const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Helper to clean up criteria keys (e.g., "1h_rsi" -> "1h RSI")
const formatCriteria = (key: string) => {
  return key.replace(/_/g, " ").toUpperCase();
};

export default function Dashboard() {
  const { data: signals, isLoading, isRefetching } = useLatestScans();
  const { mutate: runScan, isPending: isScanning } = useRunScan();

  const handleScan = () => {
    runScan();
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12 font-body selection:bg-primary/20">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-gradient">
              Market Scanner
            </h1>
            <p className="text-muted-foreground text-lg max-w-lg">
              Real-time technical analysis for high-probability setups across Crypto and Stocks.
            </p>
          </div>
          
          <Button 
            onClick={handleScan} 
            disabled={isScanning || isRefetching}
            size="lg"
            variant="glow"
            className="group min-w-[180px]"
          >
            {isScanning ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-5 w-5 group-hover:rotate-180 transition-transform duration-500" />
                Run Analysis
              </>
            )}
          </Button>
        </div>

        {/* Stats / Overview Cards could go here if we had aggregated data */}

        {/* Main Content Area */}
        <div className="glass-panel rounded-3xl overflow-hidden border border-white/5">
          <div className="p-6 md:p-8 border-b border-white/5 bg-black/20 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold font-display">Latest Opportunities</h2>
            </div>
            {isRefetching && !isScanning && (
              <span className="text-xs text-muted-foreground flex items-center gap-2 animate-pulse">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Auto-refreshing...
              </span>
            )}
          </div>

          <div className="relative overflow-x-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4 text-muted-foreground">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p>Analyzing market data...</p>
              </div>
            ) : !signals || signals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-6 text-muted-foreground">
                <div className="bg-white/5 p-6 rounded-full">
                  <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-foreground">No signals found</p>
                  <p className="text-sm mt-1">Try running a new scan to find opportunities.</p>
                </div>
                <Button variant="outline" onClick={handleScan}>Run First Scan</Button>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-muted-foreground font-display uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Symbol</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold">Score</th>
                    <th className="px-6 py-4 font-semibold">Invalidation</th>
                    <th className="px-6 py-4 font-semibold">Criteria Met</th>
                    <th className="px-6 py-4 font-semibold text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence>
                    {signals.map((signal, index) => (
                      <motion.tr 
                        key={signal.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className="group hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-6 py-4 font-medium text-base">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
                              signal.type === 'crypto' 
                                ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' 
                                : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                            }`}>
                              {signal.symbol.substring(0, 1)}
                            </div>
                            <span className="text-foreground group-hover:text-primary transition-colors">
                              {signal.symbol.replace('X:', '')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="capitalize text-muted-foreground">{signal.type}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-full max-w-[80px] h-2 bg-secondary rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400" 
                                style={{ width: `${Math.min(signal.score, 100)}%` }}
                              />
                            </div>
                            <span className={`font-bold ${signal.score >= 80 ? 'text-emerald-400' : 'text-foreground'}`}>
                              {signal.score}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-muted-foreground">
                          {formatMoney(signal.invalidationPrice)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(signal.criteria as Record<string, boolean>)
                              .filter(([_, value]) => value)
                              .map(([key]) => (
                                <Badge key={key} variant="success" className="font-mono text-[10px] uppercase">
                                  {formatCriteria(key)}
                                </Badge>
                              ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-muted-foreground tabular-nums">
                          {new Date(signal.timestamp!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            )}
          </div>
        </div>
        
        <footer className="text-center text-sm text-muted-foreground pt-12">
          <p>Market data is for informational purposes only. Not financial advice.</p>
        </footer>
      </div>
    </div>
  );
}
