import { lightningChart, emptyFill, ChartXY, LineSeries, AreaRangeSeries, OHLCSeriesTraditional, OHLCCandleStick, OHLCFigures, XOHLC, Point, AxisTickStrategies, Axis, emptyTick, VisibleTicks, emptyLine } from "@arction/lcjs"

//#region ----- Application configuration -----

// To disable/enable/modify charts inside application, alter values below:

const chartConfigOHLC = {
    show: true,
    verticalSpans: 3,
    /**
     * Simple Moving Average.
     */
    sma: {
        show: true
    },
    /**
     * Exponential Moving Average.
     */
    ema: {
        show: true
    },
    /**
     * Bollinger Bands.
     */
    bollinger: {
        show: true
    }
}
const chartConfigVolume = {
    show: true,
    verticalSpans: 1
}
const chartConfigRSI = {
    show: false,
    verticalSpans: 1
}

// Market data is currently always requested and parsed from worldtradingdata.com
enum DataSources { WorldTradingData }
const dataSource = DataSources.WorldTradingData
let dataSourceApiToken: string | undefined

/**
 * Choose a DateTime origin. LCJS uses this to optimize DateTime Axis performance.
 * A good reference is value is the expected start Date of used data.
 */
const dateTimeOrigin = new Date(
    // Year
    2019,
    // Month [0, 11]
    0,
    // Day [1, 31]
    1
)

//#endregion

//#region ----- Read worldtradingdata.com API token from local file 'wtd-token.json' -----
if ( dataSource === DataSources.WorldTradingData ) {
    try {
        const tokenJSON = require('../wtd-token.json')
        dataSourceApiToken = tokenJSON.token
    } catch (e) {
        dataSourceApiToken = undefined
    }
    if ( dataSourceApiToken === undefined || dataSourceApiToken === 'demo' ) {
        console.log('No API token for worldtradingdata.com')
        const registerUrl = 'https://www.worldtradingdata.com/register'

        if ( window.confirm( `No API token for worldtradingdata.com!
Register at ${registerUrl} for free, and write your API token to file: 'wtd-token.json'` ) ) {
            // Attempt to open new tab in above webpage directly. Note that often browsers block this operation.
            window.open( registerUrl )
        }
    }
}
//#endregion

//#region ----- Find referenced DOM elements from 'index.html' -----
const domElementIDs = {
    chartContainer: 'trading-chart-container',
    dataSearchInput: 'trading-data-search-input',
    dataSearchActivate: 'trading-data-search-activate'
}
const domElements = new Map<string, HTMLElement>()
Object.keys(domElementIDs).forEach((key) => {
    const domElementID = domElementIDs[ key ]
    const domElement = document.getElementById( domElementID )
    if ( domElement === undefined )
        throw new Error( 'DOM element not found: ' + domElementID )
    domElements.set( domElementID, domElement )
})
//#endregion

//#region ----- Create Dashboard and Charts -----

//#region ----- Create Dashboard -----
const chartConfigs = [ chartConfigOHLC, chartConfigVolume, chartConfigRSI ]
/**
 * Utility function for counting the row span before a specified chart index.
 */
const countRowSpanForChart = ( chartIndex: number ) => chartConfigs.reduce(
    (sum, chartConfig, i) => sum + (chartConfig.show && i < chartIndex ? chartConfig.verticalSpans : 0),
    0
)

// Create Dashboard inside chart container div. 
const dashboard = lightningChart().Dashboard({
    containerId: domElementIDs.chartContainer,
    numberOfColumns: 1,
    // Count row span for all charts.
    numberOfRows: countRowSpanForChart( chartConfigs.length )
})
//#endregion

//#region ----- Create OHLC Chart -----
let chartOHLC: ChartXY | undefined
let seriesOHLC: OHLCSeriesTraditional<OHLCCandleStick, OHLCCandleStick> | undefined
let seriesSMA: LineSeries | undefined
let seriesEMA: LineSeries | undefined
let seriesBollinger: AreaRangeSeries | undefined

if ( chartConfigOHLC.show ) {
    chartOHLC = dashboard.createChartXY({
        columnIndex: 0,
        columnSpan: 1,
        rowIndex: countRowSpanForChart( chartConfigs.indexOf( chartConfigOHLC ) ),
        rowSpan: chartConfigOHLC.verticalSpans
    })
        // Remove title.
        .setTitleFillStyle( emptyFill )

    // Create OHLC Series.
    seriesOHLC = chartOHLC.addOHLCSeries({
        positiveFigure: OHLCFigures.Candlestick,
        negativeFigure: OHLCFigures.Candlestick
    })

    if ( chartConfigOHLC.sma.show ) {
        // Create SMA Series.
        
    }

    if ( chartConfigOHLC.ema.show ) {
        // Create EMA Series.

    }

    if ( chartConfigOHLC.bollinger.show ) {
        // Create Bollinger Series.

    }
}
//#endregion

//#region ----- Create Volume Chart -----
let chartVolume: ChartXY | undefined

if ( chartConfigVolume.show ) {
    chartVolume = dashboard.createChartXY({
        columnIndex: 0,
        columnSpan: 1,
        rowIndex: countRowSpanForChart( chartConfigs.indexOf( chartConfigVolume ) ),
        rowSpan: chartConfigVolume.verticalSpans
    })
        // Remove title.
        .setTitleFillStyle( emptyFill )
}
//#endregion

//#region ----- Create RSI Chart -----
let chartRSI: ChartXY | undefined
//#endregion

const charts = [ chartOHLC, chartVolume, chartRSI ]
// Find lowest shown Chart index.
const lowestShownChartIndex = chartConfigs.reduce(
    (prev, chartConfig, i) => chartConfig.show ? i : prev,
    -1
)

// Configure Axes of Charts.
let dateTimeAxis: Axis

for ( let i = 0; i < charts.length; i ++ ) {
    const chart = charts[i]
    if ( chart !== undefined ) {
        const axisX = chart.getDefaultAxisX()
        const axisY = chart.getDefaultAxisY()
        if ( i === lowestShownChartIndex ) {
            // This Chart is the lowest one, it will contain a shared DateTime Axis.
            dateTimeAxis = chart.addAxisX(
                false,
                AxisTickStrategies.DateTime( dateTimeOrigin )
            )
            // Remove default X Axis.
            chart.getDefaultAxisX().dispose()
        } else {
            // This Charts X Axis will be hidden, and configured to scroll according to the shared DateTime Axis.
            axisX
                .setTickStyle((ticks: VisibleTicks) => ticks
                    .setLabelFillStyle( emptyFill )
                    .setTickLength( 0 )
                )
                .setStrokeStyle( emptyLine )
                // TODO: Why cant Nibs be hidden?
                // .setNibStyle( emptyLine )
                // Disable scrolling.
                .setScrollStrategy( undefined )
        }

    }
}


//#endregion

//#region ----- Implement logic for rendering supplied data -----

interface StringOHLCWithVolume {
    close: string
    high: string
    low: string
    open: string
    volume: string
}
interface AppDataFormat {
    name: string,
    /**
     * 'history' is an object whose keys are UTC Dates as Strings.
     * 
     * Each value is an OHLC value with an additional 'volume'-field.
     * Note that at this stage values are strings, not numbers! To use with LCJS they must be parsed to Numbers.
     */
    history: { [key: string]: StringOHLCWithVolume }
}
const renderOHLCData = ( data: AppDataFormat ) => {
    //#region ----- Prepare data for rendering with LCJS -----
    // Map values to LCJS accepted format, where the date is formatted to a Number.
    const xohlcValues: XOHLC[] = []
    // Separate Volume values from OHLC.
    const volumeValues: Point[] = []

    // Measure operation time.
    const tStart = window.performance.now()

    // Get starting Date from first item.
    const dataKeys = Object.keys( data.history )
    const startDate = new Date( dataKeys[0] )

    const dataKeysLen = dataKeys.length
    // Index data values starting from x = 0.
    for ( let x = 0; x < dataKeysLen; x ++ ) {
        const stringValues = data.history[ dataKeys[ x ] ]
        const o = Number( stringValues.open )
        const h = Number( stringValues.high )
        const l = Number( stringValues.low )
        const c = Number( stringValues.close )
        const volume = Number( stringValues.volume )

        xohlcValues.push([x, o, h, l, c])
        volumeValues.push({ x, y: volume })
    }
    console.log(`Prepared data in ${((window.performance.now() - tStart) / 1000).toFixed(1)} s`)
    console.log(`${xohlcValues.length} XOHLC values, ${volumeValues.length} Volume values.`)
    //#endregion

    //#region ----- Render data -----
    // Configure DateTime Axis.


    if ( seriesOHLC ) {
        seriesOHLC
            .clear()
            .add( xohlcValues )
    }

    //#endregion
}

//#endregion

//#region ----- Subscribe to data-search events for searching and rendering data -----

// Function that handles event where data search failed.
const dataSearchFailed = ( searchSymbol: string ) => {
    console.log('No data found for \'', searchSymbol, '\'')
}

// Define function that searches OHLC data.
const searchData = ( searchSymbol: string ) => {
    if ( dataSource === DataSources.WorldTradingData ) {
        // Use worldtradingdata.com API.
        console.log('Requesting worldtradingdata.com for \'' + searchSymbol + '\'')
        /**
         * Symbol to search.
         */
        const symbol: string = searchSymbol
        /**
         * Free worldtradingdata.com API Token.
         */
        const apiToken: 'demo' | string = dataSourceApiToken
        /**
         * Start date of data retrieval.
         *
         * YYYY-MM-DD
         */
        const date_from: string = '2019-01-01'
        /**
         * Sorting basis.
         */
        const sort: 'asc' | 'desc' | 'newest' | 'oldest' = 'asc'

        fetch(`https://www.worldtradingdata.com/api/v1/history?symbol=${symbol}&date_from=${date_from}&sort=${sort}&api_token=${apiToken}`)
            // It would seem that worldtradingdata.com doesn't set response.ok flag when requested stock is not found.    
            // .then((response) => {
            //     if (! response.ok)
            //         dataSearchFailed( searchSymbol )
            //     else
            //         return response
            // })
            .then((response) => response.json())
            .then((data: AppDataFormat) => {
                // Check for static error message.
                if ( 'Message' in data ) {
                    // Assume error message.
                    dataSearchFailed( searchSymbol )
                } else {
                    console.log('Received data from worldtradingdata.com')
                    console.log(data)
    
                    renderOHLCData(data)
                }
            })
    }
    else
        throw new Error('Unknown data source.')
}

// Subscribe to event when data-search is activated.
domElements.get( domElementIDs.dataSearchActivate )
    .addEventListener('click', (event: MouseEvent) => {
        // Get search symbol from input field.
        const inputField = domElements.get( domElementIDs.dataSearchInput ) as HTMLInputElement
        const searchSymbol = inputField.value
        searchData( searchSymbol )
    })

//#endregion



//#region ----- Style application -----

// Add top padding to very first Chart, so nothing is hidden by data-search input.
charts[0].setPadding({ top: 30 })

//#endregion



// Development configuration.
;(<HTMLInputElement>domElements.get( domElementIDs.dataSearchInput )).value = 'AAPL'

