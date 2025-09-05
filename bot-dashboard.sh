#!/bin/bash

# 📊 AwesomeSauceToken Maximum Profit Bot - Real-Time Dashboard
# Shows live trading performance, P&L, and system status

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Function to print colored output
print_header() {
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} ${CYAN}🎯 AwesomeSauceToken MAXIMUM PROFIT Bot - Real-Time Dashboard${NC} ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
}

print_section() {
    echo -e "${YELLOW}┌─────────────────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${YELLOW}│${NC} ${PURPLE}$1${NC} ${YELLOW}│${NC}"
    echo -e "${YELLOW}└─────────────────────────────────────────────────────────────────────────────┘${NC}"
}

print_metric() {
    printf "${CYAN}%-25s${NC} ${GREEN}%s${NC}\n" "$1:" "$2"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Clear screen
clear

# Main dashboard loop
while true; do
    # Get current timestamp
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

    # Clear screen and print header
    clear
    print_header
    echo -e "${BLUE}Last Update: ${NC}$TIMESTAMP"
    echo ""

    # Service Status
    print_section "🤖 BOT STATUS"
    if systemctl is-active --quiet awesomesauce-maxprofit-bot.service 2>/dev/null; then
        print_success "Bot Service: RUNNING"
        BOT_STATUS="RUNNING"
    else
        print_error "Bot Service: STOPPED"
        BOT_STATUS="STOPPED"
    fi

    # Check if bot process is running
    BOT_PID=$(pgrep -f "independent-trading-bot" | head -1)
    if [ ! -z "$BOT_PID" ]; then
        print_success "Bot Process: ACTIVE (PID: $BOT_PID)"
    else
        print_error "Bot Process: NOT FOUND"
    fi
    echo ""

    # System Resources
    print_section "💻 SYSTEM RESOURCES"
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1"%"}')
    MEM_USAGE=$(free | grep Mem | awk '{printf "%.1f%%", $3/$2 * 100.0}')
    DISK_USAGE=$(df / | tail -1 | awk '{print $5}')

    print_metric "CPU Usage" "$CPU_USAGE"
    print_metric "Memory Usage" "$MEM_USAGE"
    print_metric "Disk Usage" "$DISK_USAGE"
    echo ""

    # Trading Performance (if log files exist)
    print_section "📈 TRADING PERFORMANCE"

    if [ -f "bot-performance.log" ]; then
        # Get last 24 hours performance
        LAST_24H=$(tail -1000 bot-performance.log | grep "$(date -d '24 hours ago' '+%Y-%m-%d')" | wc -l)
        TODAY_TRADES=$(grep "$(date '+%Y-%m-%d')" bot-performance.log | wc -l)
        TOTAL_TRADES=$(wc -l < bot-performance.log)

        # Calculate win rate (simplified)
        WINS=$(grep -c "PROFIT:" bot-performance.log)
        LOSSES=$(grep -c "LOSS:" bot-performance.log)
        if [ $((WINS + LOSSES)) -gt 0 ]; then
            WIN_RATE=$((WINS * 100 / (WINS + LOSSES)))
        else
            WIN_RATE=0
        fi

        print_metric "Total Trades" "$TOTAL_TRADES"
        print_metric "Today's Trades" "$TODAY_TRADES"
        print_metric "Last 24h Trades" "$LAST_24H"
        print_metric "Win Rate" "${WIN_RATE}%"
    else
        print_warning "No performance data available yet"
        print_metric "Total Trades" "0"
        print_metric "Today's Trades" "0"
        print_metric "Win Rate" "N/A"
    fi
    echo ""

    # Recent Activity
    print_section "🔄 RECENT ACTIVITY"
    if [ -f "bot-activity.log" ]; then
        echo -e "${CYAN}Last 5 activities:${NC}"
        tail -5 bot-activity.log | while read line; do
            echo "  $line"
        done
    else
        print_warning "No activity log available"
    fi
    echo ""

    # Active Positions (placeholder - would need to integrate with bot)
    print_section "📊 ACTIVE POSITIONS"
    print_warning "Position tracking coming soon"
    print_metric "Open Positions" "N/A"
    print_metric "Total Value" "N/A"
    echo ""

    # Risk Metrics
    print_section "⚠️  RISK METRICS"
    if [ -f ".env" ]; then
        TRADE_AMOUNT=$(grep "TRADE_AMOUNT" .env | cut -d'=' -f2)
        MAX_DAILY_LOSS=$(grep "MAX_DAILY_LOSS" .env | cut -d'=' -f2)
        print_metric "Trade Amount" "${TRADE_AMOUNT} ETH"
        print_metric "Max Daily Loss" "${MAX_DAILY_LOSS} ETH"
    else
        print_error "Configuration file not found"
    fi
    echo ""

    # Market Conditions (simplified)
    print_section "🌍 MARKET STATUS"
    print_metric "ETH Price" "Fetching..."
    print_metric "Gas Price" "Fetching..."
    print_metric "Network Status" "Checking..."
    echo ""

    # Commands
    print_section "🎮 QUICK COMMANDS"
    echo -e "${CYAN}Available commands:${NC}"
    echo "  r  - Restart bot"
    echo "  s  - Stop bot"
    echo "  l  - View detailed logs"
    echo "  p  - View performance report"
    echo "  q  - Quit dashboard"
    echo ""

    # Wait for user input with timeout
    echo -e "${BLUE}Press command key or wait for auto-refresh...${NC}"
    read -t 10 -n 1 -s COMMAND
    echo ""

    case $COMMAND in
        r|R)
            echo "Restarting bot..."
            sudo systemctl restart awesomesauce-maxprofit-bot.service
            sleep 2
            ;;
        s|S)
            echo "Stopping bot..."
            sudo systemctl stop awesomesauce-maxprofit-bot.service
            sleep 2
            ;;
        l|L)
            echo "Showing detailed logs..."
            sudo journalctl -u awesomesauce-maxprofit-bot.service -n 50 --no-pager
            echo ""
            read -p "Press Enter to continue..."
            ;;
        p|P)
            echo "Generating performance report..."
            if [ -f "bot-performance.log" ]; then
                echo "=== Performance Report ==="
                echo "Total Trades: $(wc -l < bot-performance.log)"
                echo "Wins: $(grep -c "PROFIT:" bot-performance.log)"
                echo "Losses: $(grep -c "LOSS:" bot-performance.log)"
                echo "=== Recent Trades ==="
                tail -10 bot-performance.log
            else
                echo "No performance data available"
            fi
            echo ""
            read -p "Press Enter to continue..."
            ;;
        q|Q)
            echo "Exiting dashboard..."
            exit 0
            ;;
        *)
            # Auto-refresh
            ;;
    esac

done
