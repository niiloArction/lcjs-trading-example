import { lightningChart, emptyFill, ChartXY, LineSeries, AreaRangeSeries, OHLCSeries, OHLCSeriesTypes, OHLCSeriesTraditional, OHLCCandleStick, OHLCFigures } from "@arction/lcjs"

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
    show: false,
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
//#endregion

//#region ----- Create RSI Chart -----
let chartRSI: ChartXY | undefined
//#endregion

const charts = [ chartOHLC, chartVolume, chartRSI ]

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
     * 'history' is an object whose keys are Dates formatted as strings in format:
     * YYYY-MM-DD.
     * 
     * Each value is an OHLC value with an additional 'volume'-field.
     * Note that at this stage values are strings, not numbers! To use with LCJS they must be parsed to Numbers.
     */
    history: { [key: string]: StringOHLCWithVolume }
}
const renderOHLCData = ( data: AppDataFormat ) => {

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
charts[0].setPadding({ top: 40 })

//#endregion

// Development configuration.
;(<HTMLInputElement>domElements.get( domElementIDs.dataSearchInput )).value = 'AAPL'

