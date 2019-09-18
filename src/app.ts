import { lightningChart, emptyFill, ChartXY, LineSeries, AreaRangeSeries, OHLCSeriesTraditional, OHLCCandleStick, OHLCFigures, XOHLC, Point, AxisTickStrategies, Axis, VisibleTicks, emptyLine, transparentFill, emptyTick, transparentLine, AreaSeries, AreaSeriesTypes, ColorRGBA, Color, SolidFill, AreaPoint, SolidLine, DataPatterns, MarkerBuilders, UIElementBuilders, CustomTick, ColorHEX } from "@arction/lcjs"

//#region ----- Application configuration -----

// To disable/enable/modify charts inside application, alter values below:

const chartConfigOHLC = {
    show: true,
    verticalSpans: 3,
    /**
     * Simple Moving Average.
     */
    sma: {
        show: true,
        averagingFrameLength: 13
    },
    /**
     * Exponential Moving Average.
     *
     * Uses same averagingFrameLength as above SMA.
     */
    ema: {
        show: true
    },
    /**
     * Bollinger Bands.
     */
    bollinger: {
        show: true,
        averagingFrameLength: 20
    }
}
const chartConfigVolume = {
    show: true,
    verticalSpans: 1
}
const chartConfigRSI = {
    show: true,
    verticalSpans: 1,
    averagingFrameLength: 13
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

const xAxisTickStrategy = AxisTickStrategies.DateTime( dateTimeOrigin )
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
        rowSpan: chartConfigOHLC.verticalSpans,
        chartXYOptions: {
            defaultAxisXTickStrategy: xAxisTickStrategy
        }
    })
        .setTitle('')

    if ( chartConfigOHLC.bollinger.show ) {
        // Create Bollinger Series.
        seriesBollinger = chartOHLC.addAreaRangeSeries()
    }
    if ( chartConfigOHLC.sma.show ) {
        // Create SMA Series.
        seriesSMA = chartOHLC.addLineSeries({
            dataPattern: DataPatterns.horizontalProgressive
        })
    }
    if ( chartConfigOHLC.ema.show ) {
        // Create EMA Series.
        seriesEMA = chartOHLC.addLineSeries({
            dataPattern: DataPatterns.horizontalProgressive
        })
    }
    // Create OHLC Series.
    seriesOHLC = chartOHLC.addOHLCSeries({
        positiveFigure: OHLCFigures.Candlestick,
        negativeFigure: OHLCFigures.Candlestick
    })
}
//#endregion

//#region ----- Create Volume Chart -----
let chartVolume: ChartXY | undefined
let seriesVolume: AreaSeries | undefined

if ( chartConfigVolume.show ) {
    chartVolume = dashboard.createChartXY({
        columnIndex: 0,
        columnSpan: 1,
        rowIndex: countRowSpanForChart( chartConfigs.indexOf( chartConfigVolume ) ),
        rowSpan: chartConfigVolume.verticalSpans,
        chartXYOptions: {
            defaultAxisXTickStrategy: xAxisTickStrategy
        }
    })
        .setTitle('Volume')

    // Create Volume Series.
    seriesVolume = chartVolume.addAreaSeries({
        type: AreaSeriesTypes.Positive
    })
}
//#endregion

//#region ----- Create RSI Chart -----
let chartRSI: ChartXY | undefined
let seriesRSI: LineSeries | undefined
let ticksRSI: CustomTick[] = []
let tickRSIThresholdLow: CustomTick | undefined
let tickRSIThresholdHigh: CustomTick | undefined

if ( chartConfigRSI.show ) {
    chartRSI = dashboard.createChartXY({
        columnIndex: 0,
        columnSpan: 1,
        rowIndex: countRowSpanForChart( chartConfigs.indexOf( chartConfigRSI ) ),
        rowSpan: chartConfigRSI.verticalSpans,
        chartXYOptions: {
            defaultAxisXTickStrategy: xAxisTickStrategy
        }
    })
        .setTitle('RSI')

    // Create RSI Series.
    seriesRSI = chartRSI.addLineSeries({
        dataPattern: DataPatterns.horizontalProgressive
    })

    // Create RSI ticks with CustomTicks, to better indicate common thresholds of 30% and 70%.
    const axisY = chartRSI.getDefaultAxisY()
        .setTickStyle( emptyTick )
        // RSI interval always from 0 to 100.
        .setInterval( 0, 100 )
        .setScrollStrategy( undefined )
    
    // Create ticks with no Background.
    const tickWithoutBackgroundBuilder = UIElementBuilders.PointableTextBox
        .addStyler(( pointableTextBox ) => pointableTextBox
            .setBackground(( background ) => background
                .setFillStyle( emptyFill )
                .setStrokeStyle( emptyLine )
                .setPointerLength( 0 )
            )
        )

    // TODO: What is this TypeScript error? This should be the right builder.
    ticksRSI.push( axisY.addCustomTick( <any>tickWithoutBackgroundBuilder )
        .setValue( 0 )
        // Disable gridline.
        .setGridStrokeLength( 0 )
    )
    // TODO: What is this TypeScript error? This should be the right builder.
    ticksRSI.push( axisY.addCustomTick( <any>tickWithoutBackgroundBuilder )
        .setValue( 100 )
        // Disable gridline.
        .setGridStrokeLength( 0 )
    )
    // TODO: What is this TypeScript error? This should be the right builder.
    tickRSIThresholdLow = axisY.addCustomTick( <any>tickWithoutBackgroundBuilder )
        .setValue( 30 )
    ticksRSI.push( tickRSIThresholdLow )
    // TODO: What is this TypeScript error? This should be the right builder.
    tickRSIThresholdHigh = axisY.addCustomTick( <any>tickWithoutBackgroundBuilder )
        .setValue( 70 )
    ticksRSI.push( tickRSIThresholdHigh )
}
//#endregion

//#region ----- Configure Axes -----
const charts = [ chartOHLC, chartVolume, chartRSI ]
// Find lowest shown Chart index.
const lowestShownChartIndex = chartConfigs.reduce(
    (prev, chartConfig, i) => chartConfig.show ? i : prev,
    -1
)
// Find highest shown Chart index.
const highestShownChartIndex = chartConfigs.reduce(
    (prev, chartConfig, i) => chartConfig.show ? Math.min( i, prev ) : prev,
    Number.MAX_SAFE_INTEGER
)
const masterAxis = charts[ lowestShownChartIndex ].getDefaultAxisX()

// Bind X Axes together.
const HandleScaleChangeX = ( chartIndex: number ) => {
    return ( start: number, end: number ) => {
        for ( let i = 0; i < charts.length; i ++ ) {
            if ( chartConfigs[i].show ) {
                const axis = charts[ i ].getDefaultAxisX()
                if ( i !== chartIndex && axis.scale.getInnerStart() !== start && axis.scale.getInnerEnd() !== end )
                    axis.setInterval( start, end )
            }
        }
    }
}
for ( let i = 0; i < charts.length; i ++ ) {
    if ( chartConfigs[i].show ) {
        const chart = charts[i]
        chart.getDefaultAxisX()
            .setScrollStrategy( undefined )
            .onScaleChange( HandleScaleChangeX( i ) )
    }
}

// i !== j && axis.scale.getInnerStart() !== start && axis.scale.getInnerEnd() !== end

//#endregion

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
    // DateTime values must be subtracted 'dateTimeOrigin' for Axes to show Date values correctly.
    const dateTimeOriginTime = dateTimeOrigin.getTime()

    const dataKeysLen = dataKeys.length
    for ( let i = 0; i < dataKeysLen; i ++ ) {
        const key = dataKeys[ i ]
        const stringValues = data.history[ key ]
        // Date-key is UTC, and can be directly transformed to Date.
        const x = new Date( key ).getTime() - dateTimeOriginTime
        const o = Number( stringValues.open )
        const h = Number( stringValues.high )
        const l = Number( stringValues.low )
        const c = Number( stringValues.close )
        const volume = Number( stringValues.volume )

        xohlcValues.push([x, o, h, l, c])
        volumeValues.push({ x, y: volume })
    }
    const xohlcValuesLen = xohlcValues.length
    const volumeValuesLen = volumeValues.length
    console.log(`Prepared data in ${((window.performance.now() - tStart) / 1000).toFixed(1)} s`)
    console.log(`${xohlcValuesLen} XOHLC values, ${volumeValuesLen} Volume values.`)
    //#endregion

    //#region ----- Render data -----
    //#region OHLC.
    if ( seriesOHLC ) {
        seriesOHLC
            .clear()
            .add( xohlcValues )
    }
    //#endregion

    //#region SMA.
    if ( seriesSMA ) {
        // Compute SMA values from XOHLC values using data-analysis library.
        const smaValues = simpleMovingAverage( xohlcValues, chartConfigOHLC.sma.averagingFrameLength )
        seriesSMA
            .clear()
            .add( smaValues )
    }
    //#endregion

    //#region EMA.
    if ( seriesEMA ) {
        // Compute EMA values from XOHLC values using data-analysis library.
        const emaValues = exponentialMovingAverage( xohlcValues, chartConfigOHLC.sma.averagingFrameLength )
        seriesEMA
            .clear()
            .add( emaValues )
    }
    //#endregion

    //#region Bollinger.
    if ( seriesBollinger ) {
        // Compute SMA values for Bollinger. Note that we use a separate averagingFrameLength from above SMA.
        const smaValues = simpleMovingAverage( xohlcValues, chartConfigOHLC.bollinger.averagingFrameLength )
        // Compute standard deviation.
        const standardDeviation2 = 2 * standardDeviation( xohlcValues )
        // Compute Bollinger band points (positive/negative).
        const bollingerPoints: AreaPoint[] = []
        const len = smaValues.length
        for ( let i = 0; i < len; i ++ ) {
            const sma = smaValues[i]
            bollingerPoints.push({
                position: sma.x,
                high: sma.y + standardDeviation2,
                low: sma.y - standardDeviation2
            })
        }
        seriesBollinger
            .clear()
            .add( bollingerPoints )
    }
    //#endregion

    //#region Volume
    if ( seriesVolume ) {
        // To render Volume values as Histogram bars, map 'volumeValues' and add step values between data-points.
        const histogramBarValues: Point[] = []
        let prev: Point | undefined
        for ( let i = 0; i < volumeValuesLen; i ++ ) {
            const cur = volumeValues[ i ]
            // Add step between previous value and cur value.
            if ( prev ) {
                histogramBarValues.push( { x: prev.x, y: cur.y } )
            }
            histogramBarValues.push( cur )
            prev = cur
        }

        seriesVolume
            .clear()
            .add( histogramBarValues )
    }
    //#endregion

    //#region RSI.

    //#endregion
    if ( seriesRSI ) {
        // Compute RSI values from XOHLC values using data-analysis library.
        const rsiValues = relativeStrengthIndex( xohlcValues, chartConfigRSI.averagingFrameLength )
        seriesRSI
            .clear()
            .add( rsiValues )
    }
    //#endregion

    // Fit new data to X view (automatic X scrolling is disabled in application).
    masterAxis.fit()

    // Set title of top-most Chart to show name data.
    charts[ highestShownChartIndex ].setTitle( data.name )

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

//#region ----- Data analysis tools TO BE MOVED TO NPM LIB -----
/**
 * Calculate SMA values from XOHLC 'close' values.
 * @param   xohlcValues             Array of XOHLC values.
 * @param   averagingFrameLength    Length of averaging frame.
 * @return                          Array of SMA values. Length of this array is 'averagingFrameLength' - 1 less than 'xohlcValues'
 */
const simpleMovingAverage = ( xohlcValues: XOHLC[], averagingFrameLength: number ): Point[] => {
    const len = xohlcValues.length
    const result: Point[] = []
    const yValueBuffer: number[] = []
    let sum = 0

    for ( let i = 0; i < len; i ++ ) {
        const xohlc = xohlcValues[i]
        // Use 'close' value for SMA.
        const value = xohlc[4]
        sum += value
        if ( i >= averagingFrameLength - 1 ) {
            // Append current average.
            const curAvg = sum / averagingFrameLength
            result.push({ x: xohlc[0], y: curAvg})
            // Drop oldest points value.
            const droppedValue = yValueBuffer.shift()
            sum -= droppedValue
        }
        yValueBuffer.push(value)
    }
    return result
}
/**
 * Calculate EMA values from XOHLC 'close' values.
 * @param   xohlcValues             Array of XOHLC values.
 * @param   averagingFrameLength    Length of averaging frame.
 * @return                          Array of EMA values.  Length of this array is equal to xohlcValues.length - averagingFrameLength + 1
 */
const exponentialMovingAverage = ( xohlcValues: XOHLC[], averagingFrameLength: number ): Point[] => {
    const len = xohlcValues.length
    const result: Point[] = []
    const weighingMultiplier = 2 / ( averagingFrameLength + 1 )

    // Calculate initial previous EMA using SMA method.
    let i
    let previousEMASum = 0
    for ( i = 0; i < averagingFrameLength; i ++ ) {
        const xohlc = xohlcValues[i]
        // Use 'close' value for SMA.
        const value = xohlc[4]
        previousEMASum += value
    }
    let previousEMA: number = previousEMASum / averagingFrameLength
    for ( ; i < len; i ++ ) {
        const xohlc = xohlcValues[i]
        // Use 'close' value for EMA.
        const value = xohlc[4]
        // Compute current EMA value.
        const ema = value * weighingMultiplier + ( previousEMA !== undefined ? previousEMA * (1 - weighingMultiplier) : 0 )
        if ( i >= averagingFrameLength - 1 ) {
            result.push({ x: xohlc[0], y: ema })
        }
        previousEMA = ema
    }
    return result
}
/**
 * Calculate standard deviation from XOHLC 'close' values.
 * @param   xohlcValues             Array of XOHLC values.
 * @return                          Standard deviation value.
 */
const standardDeviation = ( xohlcValues: XOHLC[] ): number => {
    const len = xohlcValues.length
    // Calculate average.
    let sum = 0
    for ( let i = 0; i < len; i ++ ) {
        sum += xohlcValues[i][4]
    }
    const avg = sum / len
    //
    let sumSqDiff = 0
    for ( let i = 0; i < len; i ++ ) {
        const value = xohlcValues[i][4]
        sumSqDiff += ( value - avg ) * ( value - avg )
    }
    return Math.sqrt( sumSqDiff / len )
}
/**
 * Calculate RSI values from XOHLC 'close' values.
 * @param   xohlcValues             Array of XOHLC values.
 * @param   averagingFrameLength    Length of averaging frame.
 * @return                          Relative Strength Index values. Length of this array is equal to xohlcValues.length - n + 1
 */
const relativeStrengthIndex = ( xohlcValues: XOHLC[], averagingFrameLength: number ): Point[] => {
    const len = xohlcValues.length
    const result: Point[] = []
    const upValues: number[] = []
    const downValues: number[] = []
    let prevValue: number | undefined
    for ( let i = 0; i < len; i ++ ) {
        // Use close value for RSI.
        const value = xohlcValues[i][4]
        if ( prevValue !== undefined ) {
            const diff = value - prevValue
            if ( diff > 0 ) {
                upValues[i] = diff
                downValues[i] = 0
            } else {
                downValues[i] = -diff   // Use positive value
                upValues[i] = 0
            }
        }
        //don't put anything to up and dn first item. It's not used 
        prevValue = value
    }
    for ( let i = averagingFrameLength; i < len; i ++ ) {
        let avgUpSum = 0
        let avgDownSum = 0
        let count = 0
        for ( let j = i; j > i - averagingFrameLength; j-- ) {
            avgUpSum += upValues[ j ]
            avgDownSum += downValues[ j ]
            count ++
        }
        const avgUp = avgUpSum / count
        const avgDown = avgDownSum / count
        const rsi = 100 - ( 100 / ( 1 + avgUp / avgDown ) )
        result.push({ x: xohlcValues[i][0], y: rsi })
    }
    return result
}


//#endregion

//#region ----- Style application -----
// Manage Colors and derived Styles using Enums and Maps.
enum AppColor {
    White,
    LightBlue,
    DarkBlue,
    DarkBlueTransparent,
    Purplish,
    Red,
    RedTransparent,
    Green,
    GreenTransparent
}
const colors = new Map<AppColor, Color>()
colors.set( AppColor.White, ColorHEX('#FFF') )
colors.set( AppColor.LightBlue, ColorRGBA( 162, 191, 244 ) )
colors.set( AppColor.DarkBlue, ColorRGBA( 75, 99, 143 ) )
colors.set( AppColor.DarkBlueTransparent, colors.get( AppColor.DarkBlue ).setA(120) )
colors.set( AppColor.Purplish, ColorRGBA( 209, 44, 144 ) )
colors.set( AppColor.Red, ColorRGBA( 219, 40, 68 ) )
colors.set( AppColor.RedTransparent, colors.get( AppColor.Red ).setA(120) )
colors.set( AppColor.Green, ColorRGBA( 28, 231, 69 ) )
colors.set( AppColor.GreenTransparent, colors.get( AppColor.Green ).setA(120) )


const solidFills = new Map<AppColor, SolidFill>()
colors.forEach((color, key) => solidFills.set( key, new SolidFill({ color }) ))

enum AppLineThickness { Thin, Thick }
const solidLines = new Map<AppColor, Map<AppLineThickness, SolidLine>>()
colors.forEach((_, key) => {
    const thicknessMap = new Map()
    thicknessMap.set( AppLineThickness.Thin, new SolidLine({ thickness: 2, fillStyle: solidFills.get( key ) }) )
    thicknessMap.set( AppLineThickness.Thick, new SolidLine({ thickness: 4, fillStyle: solidFills.get( key ) }) )
    solidLines.set( key, thicknessMap )
})

// Style Charts.
for ( let i = 0; i < charts.length; i ++ ) {
    const chart = charts[i]
    if ( chart ) {
        chart
            .setTitleFont((font) => font
                // Highest Chart, which shows name of data, has bigger font.
                .setSize( i === highestShownChartIndex ? 20 : 10 )
            )
            .setTitleMarginTop( 4 )
            .setTitleMarginBottom( 2 )
            .setPadding({ top: 0 })
        }
}

// Add top padding to very first Chart, so nothing is hidden by data-search input.
// charts[0].setPadding({ top: 20 })

// Style Axes.
for ( let i = 0; i < charts.length; i ++ ) {
    const chart = charts[i]
    if ( chart !== undefined ) {
        const axisX = chart.getDefaultAxisX()
        const axisY = chart.getDefaultAxisY()
        const isChartWithMasterAxis = axisX === masterAxis

        if ( ! isChartWithMasterAxis ) {
            // This Charts X Axis will be hidden, and configured to scroll according to the master Axis.
            axisX
                .setTickStyle(emptyTick)
                .setStrokeStyle( emptyLine )
                // TODO: Why cant Nibs be hidden?
                .setNibStyle( <any>emptyLine )
                // Disable scrolling.
                .setScrollStrategy( undefined )
                // Disable mouse interactions on hidden Axes.
                .setMouseInteractions( false )
                
        } else {
            // This Chart has the Master Axis.
            axisX
                .setTickStyle((ticks: VisibleTicks) => ticks
                    // Hide GridLines, but keep ticks.
                    .setGridStrokeStyle( transparentLine )
                )
        }
    }
}

// Style Series.
if ( seriesSMA )
    seriesSMA
        .setStrokeStyle(( solidLine ) => solidLine
            .setFillStyle( solidFills.get( AppColor.Purplish ) )
        )
if ( seriesEMA )
    seriesEMA
        .setStrokeStyle(( solidLine ) => solidLine
            .setFillStyle( solidFills.get( AppColor.LightBlue ) )
        )
if ( seriesBollinger )
    seriesBollinger
        .setHighFillStyle( solidFills.get( AppColor.DarkBlueTransparent ) )
        .setLowFillStyle( solidFills.get( AppColor.DarkBlueTransparent ) )
        .setHighStrokeStyle( solidLines.get( AppColor.LightBlue ).get( AppLineThickness.Thin ) )
        .setLowStrokeStyle( solidLines.get( AppColor.LightBlue ).get( AppLineThickness.Thin ) )
if ( seriesRSI )
    seriesRSI
        .setStrokeStyle( solidLines.get( AppColor.White ).get( AppLineThickness.Thin ) )

// Style RSI ticks.
if ( tickRSIThresholdLow )
    tickRSIThresholdLow
        .setGridStrokeStyle( solidLines.get( AppColor.GreenTransparent ).get( AppLineThickness.Thin ) )

if ( tickRSIThresholdHigh )
tickRSIThresholdHigh
        .setGridStrokeStyle( solidLines.get( AppColor.RedTransparent ).get( AppLineThickness.Thin ) )

// TODO: ResultTableFormatters.

//#endregion



// Development configuration.
;(<HTMLInputElement>domElements.get( domElementIDs.dataSearchInput )).value = 'AAPL'

