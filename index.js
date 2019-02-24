// @flow
// #!/usr/bin/env node
// -*- coding: utf-8 -*-
/** @module clientnode */
'use strict'
/* !
    region header
    [Project page](https://torben.website/clientnode)

    Copyright Torben Sickert (info["~at~"]torben.website) 16.12.2012

    License
    -------

    This library written by Torben Sickert stand under a creative commons
    naming 3.0 unported license.
    See https://creativecommons.org/licenses/by/3.0/deed.de
    endregion
*/
// region imports
import type {ChildProcess} from 'child_process'
let fileSystem:Object = {}
try {
    fileSystem = eval('require')('fs')
} catch (error) {}
let path:Object = {}
try {
    path = eval('require')('path')
} catch (error) {}
// endregion
// region types
export type PlainObject = {[key:string]:any}
export type ProcedureFunction = () => void|Promise<void>
export type File = {
    directoryPath:string;
    error:Error|null;
    name:string;
    path:string;
    stats:Object|null;
}
export type GetterFunction = (keyOrValue:any, key:?any, target:?any) => any
export type SetterFunction = (key:any, value:any, target:?any) => any
export type Position = {
    top?:number;
    left?:number;
    right?:number;
    bottom?:number;
}
export type RelativePosition = 'in'|'above'|'left'|'below'|'right'
export type Options = {
    domNodeSelectorPrefix:string;
    [key:string]:any;
}
export type LockCallbackFunction = (description:string) => ?Promise<any>
export type $DomNode = {
    [key:number|string]:DomNode;
    addClass(className:string):$DomNode;
    addBack():$DomNode;
    after(domNode:any):$DomNode;
    append(domNode:any):$DomNode;
    attr(attributeName:string|{[key:string]:string}, value:any):any;
    data(key:string, value:any):any;
    each():$DomNode;
    find(filter:any):$DomNode;
    height():number;
    is(selector:string):boolean;
    remove():$DomNode;
    removeAttr(attributeName:string):$DomNode;
    removeClass(className:string|Array<string>):$DomNode;
    submit():$DomNode;
    width():number;
    Tools(functionName:string, ...additionalArguments:Array<any>):any;
}
export type $Deferred<Type> = {
    always:() => $Deferred<Type>;
    resolve:() => $Deferred<Type>;
    done:() => $Deferred<Type>;
    fail:() => $Deferred<Type>;
    isRejected:() => $Deferred<Type>;
    isResolved:() => $Deferred<Type>;
    notify:() => $Deferred<Type>;
    notifyWith:() => $Deferred<Type>;
    progress:() => $Deferred<Type>;
    promise:() => $Deferred<Type>;
    reject:() => $Deferred<Type>;
    rejectWith:() => $Deferred<Type>;
    resolveWith:() => $Deferred<Type>;
    state:() => $Deferred<Type>;
    then:() => $Deferred<Type>;
}
// / region browser
export type DomNode = any
export type Location = {
    hash:string;
    search:string;
    pathname:string;
    port:string;
    hostname:string;
    host:string;
    protocol:string;
    origin:string;
    href:string;
    username:string;
    password:string;
    assign:Function;
    reload:Function;
    replace:Function;
    toString:() => string
}
export type Storage = {
    getItem(key:string):any;
    setItem(key:string, value:any):void;
    removeItem(key:string, value:any):void;
}
export type Window = {
    addEventListener:(type:string, callback:Function) => void;
    document:Object;
    location:Location;
    localStorage:Storage;
    sessionStorage:Storage;
    close:() => void;
}
// / endregion
// endregion
// region determine context
export const globalContext:Object = (():Object => {
    if (typeof window === 'undefined') {
        if (typeof global === 'undefined')
            return (typeof module === 'undefined') ? {} : module
        if ('window' in global)
            return global.window
        return global
    }
    return window
})()
/* eslint-disable no-use-before-define */
export const $:any = (():any => {
/* eslint-enable no-use-before-define */
    let $:any
    if ('$' in globalContext && globalContext.$ !== null)
        $ = globalContext.$
    else {
        if (!('$' in globalContext) && 'document' in globalContext)
            try {
                return require('jquery')
            } catch (error) {}
        const selector:any = (
            'document' in globalContext &&
            'querySelectorAll' in globalContext.document
        ) ?
            globalContext.document.querySelectorAll.bind(
                globalContext.document
            ) : ():null => null
        $ = (parameter:any, ...additionalArguments:Array<any>):any => {
            if (typeof parameter === 'string') {
                const $domNodes:Array<any> = selector(
                    parameter, ...additionalArguments)
                if ('fn' in $)
                    for (const key:string in $.fn)
                        if ($.fn.hasOwnProperty(key))
                            // IgnoreTypeCheck
                            $domNodes[key] = $.fn[key].bind($domNodes)
                return $domNodes
            }
            /* eslint-disable no-use-before-define */
            if (Tools.isFunction(parameter) && 'document' in globalContext)
            /* eslint-enable no-use-before-define */
                globalContext.document.addEventListener(
                    'DOMContentLoaded', parameter)
            return parameter
        }
        $.fn = {}
    }
    return $
})()
if (!('global' in $))
    $.global = globalContext
if (!('context' in $) && 'document' in $.global)
    $.context = $.global.document
// endregion
// region plugins/classes
/**
 * Represents the semaphore state.
 * @property queue - List of waiting resource requests.
 * @property numberOfFreeResources - Number free allowed concurrent resource
 * uses.
 * @property numberOfResources - Number of allowed concurrent resource uses.
 */
export class Semaphore {
    queue:Array<Function> = []
    numberOfResources:number
    numberOfFreeResources:number
    /**
     * Initializes number of resources.
     * @param numberOfResources - Number of resources to manage.
     * @returns Nothing.
     */
    constructor(numberOfResources:number = 2) {
        this.numberOfResources = numberOfResources
        this.numberOfFreeResources = numberOfResources
    }
    /**
     * Acquires a new resource and runs given callback if available.
     * @returns A promise which will be resolved if requested resource
     * is available.
     */
    acquire():Promise<void> {
        return new Promise((resolve:Function):void => {
            if (this.numberOfFreeResources <= 0)
                this.queue.push(resolve)
            else {
                this.numberOfFreeResources -= 1
                resolve(this.numberOfFreeResources)
            }
        })
    }
    /**
     * Releases a resource and runs a waiting resolver if there exists
     * some.
     * @returns Nothing.
     */
    release():void {
        if (this.queue.length === 0)
            this.numberOfFreeResources += 1
        else
            this.queue.pop()(this.numberOfFreeResources)
    }
}
/**
 * This plugin provides such interface logic like generic controller logic for
 * integrating plugins into $, mutual exclusion for depending gui elements,
 * logging additional string, array or function handling. A set of helper
 * functions to parse option objects dom trees or handle events is also
 * provided.
 * @property static:abbreviations - Lists all known abbreviation for proper
 * camel case to delimited and back conversion.
 * @property static:animationEndEventNames - Saves a string with all css3
 * browser specific animation end event names.
 * @property static:classToTypeMapping - String representation to object type
 * name mapping.
 * @property static:closeEventNames - Process event names which indicates that
 * a process has finished.
 * @property static:consoleMethodNames - This variable contains a collection of
 * methods usually binded to the console object.
 * @property static:keyCode - Saves a mapping from key codes to their
 * corresponding name.
 * @property static:maximalSupportedInternetExplorerVersion - Saves currently
 * minimal supported internet explorer version. Saves zero if no internet
 * explorer present.
 * @property static:noop - A no-op dummy function.
 * @property static:specialRegexSequences - A list of special regular
 * expression symbols.
 * @property static:transitionEndEventNames - Saves a string with all css3
 * browser specific transition end event names.
 *
 * @property static:_dateTimePatternCache - Caches compiled date tine pattern
 * regular expressions.
 * @property static:_name - Not minifyable class name.
 * @property static:_javaScriptDependentContentHandled - Indicates whether
 * javaScript dependent content where hide or shown.
 *
 * @property $domNode - $-extended dom node if one was given to the constructor
 * method.
 * @property locks - Mapping of lock descriptions to there corresponding
 * callbacks.
 *
 * @property _options - Options given to the constructor.
 * @property _defaultOptions - Fallback options if not overwritten by the
 * options given to the constructor method.
 * @property _defaultOptions.logging {boolean} - Indicates whether logging
 * should be active.
 * @property _defaultOptions.domNodeSelectorPrefix {string} - Selector prefix
 * for all needed dom nodes.
 * @property _defaultOptions.domNode {Object.<string, string>} - Mapping of
 * names to needed dom nodes referenced by there selector.
 * @property _defaultOptions.domNode.hideJavaScriptEnabled {string} - Selector
 * to dom nodes which should be hidden if javaScript is available.
 * @property _defaultOptions.domNode.showJavaScriptEnabled {string} - Selector
 * to dom nodes which should be visible if javaScript is available.
 */
export class Tools {
    // region static properties
    static abbreviations:Array<string> = [
        'html', 'id', 'url', 'us', 'de', 'api', 'href']
    static animationEndEventNames:string = 'animationend webkitAnimationEnd ' +
        'oAnimationEnd MSAnimationEnd'
    static classToTypeMapping:{[key:string]:string} = {
        '[object Array]': 'array',
        '[object Boolean]': 'boolean',
        '[object Date]': 'date',
        '[object Error]': 'error',
        '[object Function]': 'function',
        '[object Map]': 'map',
        '[object Number]': 'number',
        '[object Object]': 'object',
        '[object RegExp]': 'regexp',
        '[object Set]': 'set',
        '[object String]': 'string'
    }
    static closeEventNames:Array<string> = [
        'exit', 'close', 'uncaughtException', 'SIGINT', 'SIGTERM', 'SIGQUIT']
    static consoleMethodNames:Array<string> = [
        'assert',
        'clear',
        'count',
        'debug',
        'dir',
        'dirxml',
        'error',
        'exception',
        'group',
        'groupCollapsed',
        'groupEnd',
        'info',
        'log',
        'markTimeline',
        'profile',
        'profileEnd',
        'table',
        'time',
        'timeEnd',
        'timeStamp',
        'trace',
        'warn'
    ]
    static keyCode:{[key:string]:number} = {
        BACKSPACE: 8,
        COMMA: 188,
        DELETE: 46,
        DOWN: 40,
        END: 35,
        ENTER: 13,
        ESCAPE: 27,
        F1: 112,
        F2: 113,
        F3: 114,
        F4: 115,
        F5: 116,
        F6: 117,
        F7: 118,
        F8: 119,
        F9: 120,
        F10: 121,
        F11: 122,
        F12: 123,
        HOME: 36,
        LEFT: 37,
        NUMPAD_ADD: 107,
        NUMPAD_DECIMAL: 110,
        NUMPAD_DIVIDE: 111,
        NUMPAD_ENTER: 108,
        NUMPAD_MULTIPLY: 106,
        NUMPAD_SUBTRACT: 109,
        PAGE_DOWN: 34,
        PAGE_UP: 33,
        PERIOD: 190,
        RIGHT: 39,
        SPACE: 32,
        TAB: 9,
        UP: 38
    }
    static maximalSupportedInternetExplorerVersion:number = (():number => {
        if (!('document' in $.global))
            return 0
        const div = $.global.document.createElement('div')
        let version:number
        for (version = 0; version < 10; version++) {
            /*
                NOTE: We split html comment sequences to avoid wrong
                interpretation if this code is embedded in markup.
                NOTE: Internet Explorer 9 and lower sometimes doesn't
                understand conditional comments wich doesn't starts with a
                whitespace. If the conditional markup isn't in a commend.
                Otherwise there shouldn't be any whitespace!
            */
            /* eslint-disable no-useless-concat */
            div.innerHTML = (
                '<!' + `--[if gt IE ${version}]><i></i><![e` + 'ndif]-' + '->')
            /* eslint-enable no-useless-concat */
            if (div.getElementsByTagName('i').length === 0)
                break
        }
        // Try special detection for internet explorer 10 and 11.
        if (version === 0 && 'navigator' in $.global)
            if ($.global.navigator.appVersion.includes('MSIE 10'))
                return 10
            else if ($.global.navigator.userAgent.includes(
                'Trident'
            ) && $.global.navigator.userAgent.includes('rv:11'))
                return 11
        return version
    })()
    static noop:Function = ('noop' in $) ? $.noop : ():void => {}
    static plainObjectPrototypes:Array<any> = [Object.prototype]
    static specialRegexSequences:Array<string> = [
        '-', '[', ']', '(', ')', '^', '$', '*', '+', '.', '{', '}']
    static transitionEndEventNames:string = 'transitionend ' +
        'webkitTransitionEnd oTransitionEnd MSTransitionEnd'

    static _dateTimePatternCache:Array<RegExp> = []
    static _javaScriptDependentContentHandled:boolean = false
    static _name:string = 'tools'
    // endregion
    // region dynamic properties
    $domNode:$DomNode
    locks:{[key:string]:Array<LockCallbackFunction>};
    _options:Options
    _defaultOptions:PlainObject
    // endregion
    // region public methods
    // / region special
    /**
     * This method should be overwritten normally. It is triggered if current
     * object is created via the "new" keyword. The dom node selector prefix
     * enforces to not globally select any dom nodes which aren't in the
     * expected scope of this plugin. "{1}" will be automatically replaced with
     * this plugin name suffix ("tools"). You don't have to use "{1}" but it
     * can help you to write code which is more reconcilable with the dry
     * concept.
     * @param $domNode - $-extended dom node to use as reference in various
     * methods.
     * @param options - Options to change runtime behavior.
     * @param defaultOptions - Default options to ensure to be present in any
     * options instance.
     * @param locks - Mapping of a lock description to callbacks for calling
     * when given lock should be released.
     * @returns Returns nothing but if invoked with "new" an instance of this
     * class will be given back.
     */
    constructor(
        $domNode:?$DomNode = null,
        options:Object = {},
        defaultOptions:PlainObject = {
            domNode: {
                hideJavaScriptEnabled: '.tools-hidden-on-javascript-enabled',
                showJavaScriptEnabled: '.tools-visible-on-javascript-enabled'
            },
            domNodeSelectorPrefix: 'body',
            logging: false
        },
        locks:{[key:string]:Array<LockCallbackFunction>} = {}
    ):void {
        if ($domNode)
            this.$domNode = $domNode
        this._options = options
        this._defaultOptions = defaultOptions
        this.locks = locks
        // Avoid errors in browsers that lack a console.
        if (!('console' in $.global))
            $.global.console = {}
        for (const methodName:string of this.constructor.consoleMethodNames)
            if (!(methodName in $.global.console))
                $.global.console[methodName] = this.constructor.noop
        if (
            !this.constructor._javaScriptDependentContentHandled &&
            'document' in $.global &&
            'filter' in $ &&
            'hide' in $ &&
            'show' in $
        ) {
            this.constructor._javaScriptDependentContentHandled = true
            $(
                `${this._defaultOptions.domNodeSelectorPrefix} ` +
                this._defaultOptions.domNode.hideJavaScriptEnabled
            ).filter(function():boolean {
                return !$(this).data('javaScriptDependentContentHide')
            }).data('javaScriptDependentContentHide', true).hide()
            $(
                `${this._defaultOptions.domNodeSelectorPrefix} ` +
                this._defaultOptions.domNode.showJavaScriptEnabled
            ).filter(function():boolean {
                return !$(this).data('javaScriptDependentContentShow')
            }).data('javaScriptDependentContentShow', true).show()
        }
    }
    /**
     * This method could be overwritten normally. It acts like a destructor.
     * @returns Returns the current instance.
     */
    destructor():Tools {
        if ('off' in $.fn)
            this.off('*')
        return this
    }
    /**
     * This method should be overwritten normally. It is triggered if current
     * object was created via the "new" keyword and is called now.
     * @param options - An options object.
     * @returns Returns the current instance.
     */
    initialize(options:PlainObject = {}):Tools {
        /*
            NOTE: We have to create a new options object instance to avoid
            changing a static options object.
        */
        this._options = this.constructor.extend(
            true, {}, this._defaultOptions, this._options, options)
        /*
            The selector prefix should be parsed after extending options
            because the selector would be overwritten otherwise.
        */
        this._options.domNodeSelectorPrefix = this.constructor.stringFormat(
            this._options.domNodeSelectorPrefix,
            this.constructor.stringCamelCaseToDelimited(
                this.constructor._name))
        return this
    }
    // / endregion
    // / region object orientation
    /* eslint-disable jsdoc/require-description-complete-sentence */
    /**
     * Defines a generic controller for dom node aware plugins.
     * @param object - The object or class to control. If "object" is a class
     * an instance will be generated.
     * @param parameter - The initially given arguments object.
     * @param $domNode - Optionally a $-extended dom node to use as reference.
     * @returns Returns whatever the initializer method returns.
     */
    controller(
        object:Object, parameter:Array<any>, $domNode:?$DomNode = null
    ):any {
    /* eslint-enable jsdoc/require-description-complete-sentence */
        if (typeof object === 'function') {
            object = new object($domNode)
            if (!(object instanceof Tools))
                object = this.constructor.extend(
                    true, new Tools(), object)
        }
        const name:string = object.constructor._name || object.constructor.name
        parameter = this.constructor.arrayMake(parameter)
        if ($domNode && 'data' in $domNode && !$domNode.data(name))
            // Attach extended object to the associated dom node.
            $domNode.data(name, object)
        if (parameter[0] in object) {
            if (Tools.isFunction(object[parameter[0]]))
                return object[parameter[0]](...parameter.slice(1))
            return object[parameter[0]]
        } else if (parameter.length === 0 || typeof parameter[0] === 'object')
            /*
                If an options object or no method name is given the initializer
                will be called.
            */
            return object.initialize(...parameter)
        throw new Error(
            `Method "${parameter[0]}" does not exist on $-extended dom node ` +
            `"${name}".`)
    }
    // / endregion
    // / region mutual exclusion
    /**
     * Calling this method introduces a starting point for a critical area with
     * potential race conditions. The area will be binded to given description
     * string. So don't use same names for different areas.
     * @param description - A short string describing the critical areas
     * properties.
     * @param callbackFunction - A procedure which should only be executed if
     * the interpreter isn't in the given critical area. The lock description
     * string will be given to the callback function.
     * @param autoRelease - Release the lock after execution of given callback.
     * @returns Returns a promise which will be resolved after releasing lock.
     */
    acquireLock(
        description:string, callbackFunction:LockCallbackFunction = Tools.noop,
        autoRelease:boolean = false
    ):Promise<any> {
        return new Promise((resolve:Function):void => {
            const wrappedCallbackFunction:LockCallbackFunction = (
                description:string
            ):?Promise<any> => {
                const result:any = callbackFunction(description)
                const finish:Function = (value:any):void => {
                    if (autoRelease)
                        this.releaseLock(description)
                    resolve(value)
                }
                try {
                    return result.then(finish)
                } catch (error) {}
                finish(description)
            }
            if (this.locks.hasOwnProperty(description))
                this.locks[description].push(wrappedCallbackFunction)
            else {
                this.locks[description] = []
                wrappedCallbackFunction(description)
            }
        })
    }
    /**
     * Calling this method  causes the given critical area to be finished and
     * all functions given to "acquireLock()" will be executed in right order.
     * @param description - A short string describing the critical areas
     * properties.
     * @returns Returns the return (maybe promise resolved) value of the
     * callback given to the "acquireLock" method.
     */
    async releaseLock(description:string):Promise<any> {
        let result:any
        if (this.locks.hasOwnProperty(description))
            if (this.locks[description].length)
                result = await this.locks[description].shift()(description)
            else
                delete this.locks[description]
        return result
    }
    /**
     * Generate a semaphore object with given number of resources.
     * @param numberOfResources - Number of allowed concurrent resource uses.
     * @returns The requested semaphore instance.
     */
    static getSemaphore(numberOfResources:number = 2):Semaphore {
        return new Semaphore(numberOfResources)
    }
    // / endregion
    // / region boolean
    /**
     * Determines whether its argument represents a JavaScript number.
     * @param object - Object to analyze.
     * @returns A boolean value indicating whether given object is numeric
     * like.
     */
    static isNumeric(object:any):boolean {
        const type:string = Tools.determineType(object)
        /*
            NOTE: "parseFloat" "NaNs" numeric-cast false positives ("") but
            misinterprets leading-number strings, particularly hex literals
            ("0x...") subtraction forces infinities to NaN.
        */
        return ['number', 'string'].includes(type) && !isNaN(
            object - parseFloat(object))
    }
    /**
     * Determine whether the argument is a window.
     * @param object - Object to check for.
     * @returns Boolean value indicating the result.
     */
    static isWindow(object:any):boolean {
        return (
            ![undefined, null].includes(object) &&
            typeof object === 'object' && 'window' in object &&
            object === object.window)
    }
    /**
     * Checks if given object is similar to an array and can be handled like an
     * array.
     * @param object - Object to check behavior for.
     * @returns A boolean value indicating whether given object is array like.
     */
    static isArrayLike(object:any):boolean {
        let length:number|boolean
        try {
            length = Boolean(
                object
            ) && 'length' in object && object.length
        } catch (error) {
            return false
        }
        const type:string = Tools.determineType(object)
        if (type === 'function' || Tools.isWindow(object))
            return false
        if (type === 'array' || length === 0)
            return true
        if (typeof length === 'number' && length > 0)
            try {
                /* eslint-disable no-unused-expressions */
                object[length - 1]
                /* eslint-enable no-unused-expressions */
                return true
            } catch (error) {}
        return false
    }
    /**
     * Checks whether one of the given pattern matches given string.
     * @param target - Target to check in pattern for.
     * @param pattern - List of pattern to check for.
     * @returns Value "true" if given object is matches by at leas one of the
     * given pattern and "false" otherwise.
     */
    static isAnyMatching(target:string, pattern:Array<string|RegExp>):boolean {
        for (const currentPattern:RegExp|string of pattern)
            if (typeof currentPattern === 'string') {
                if (currentPattern === target)
                    return true
            } else if (currentPattern.test(target))
                return true
        return false
    }
    /**
     * Checks whether given object is a plain native object.
     * @param object - Object to check.
     * @returns Value "true" if given object is a plain javaScript object and
     * "false" otherwise.
     */
    static isPlainObject(object:mixed):boolean {
        return (
            typeof object === 'object' &&
            object !== null &&
            Tools.plainObjectPrototypes.includes(Object.getPrototypeOf(object))
        )
    }
    /**
     * Checks whether given object is a function.
     * @param object - Object to check.
     * @returns Value "true" if given object is a function and "false"
     * otherwise.
     */
    static isFunction(object:mixed):boolean {
        return (
            Boolean(object) &&
            ['[object AsyncFunction]', '[object Function]'].includes(
                {}.toString.call(object)
            )
        )
    }
    // / endregion
    // / region language fixes
    /**
     * This method fixes an ugly javaScript bug. If you add a mouseout event
     * listener to a dom node the given handler will be called each time any
     * dom node inside the observed dom node triggers a mouseout event. This
     * methods guarantees that the given event handler is only called if the
     * observed dom node was leaved.
     * @param eventHandler - The mouse out event handler.
     * @returns Returns the given function wrapped by the workaround logic.
     */
    static mouseOutEventHandlerFix(eventHandler:Function):Function {
        return (event:Object, ...additionalParameter:Array<any>):any => {
            let relatedTarget:DomNode = event.toElement
            if ('relatedTarget' in event)
                relatedTarget = event.relatedTarget
            while (relatedTarget && relatedTarget.tagName !== 'BODY') {
                if (relatedTarget === this)
                    return
                relatedTarget = relatedTarget.parentNode
            }
            return eventHandler.call(this, ...additionalParameter)
        }
    }
    // / endregion
    // / region logging
    /**
     * Shows the given object's representation in the browsers console if
     * possible or in a standalone alert-window as fallback.
     * @param object - Any object to print.
     * @param force - If set to "true" given input will be shown independently
     * from current logging configuration or interpreter's console
     * implementation.
     * @param avoidAnnotation - If set to "true" given input has no module or
     * log level specific annotations.
     * @param level - Description of log messages importance.
     * @param additionalArguments - Additional arguments are used for string
     * formating.
     * @returns Returns the current instance.
     */
    log(
        object:any, force:boolean = false, avoidAnnotation:boolean = false,
        level:string = 'info', ...additionalArguments:Array<any>
    ):Tools {
        if (this._options.logging || force || ['error', 'critical'].includes(
            level
        )) {
            let message:any
            if (avoidAnnotation)
                message = object
            else if (typeof object === 'string') {
                additionalArguments.unshift(object)
                message = `${this.constructor._name} (${level}): ` +
                    this.constructor.stringFormat(...additionalArguments)
            } else if (this.constructor.isNumeric(
                object
            ) || typeof object === 'boolean')
                message = `${this.constructor._name} (${level}): ` +
                    object.toString()
            else {
                this.log(',--------------------------------------------,')
                this.log(object, force, true)
                this.log(`'--------------------------------------------'`)
            }
            if (message)
                if (!('console' in $.global && level in $.global.console) || (
                    $.global.console[level] === this.constructor.noop
                )) {
                    if ('alert' in $.global)
                        $.global.alert(message)
                } else
                    $.global.console[level](message)
        }
        return this
    }
    /**
     * Wrapper method for the native console method usually provided by
     * interpreter.
     * @param object - Any object to print.
     * @param additionalArguments - Additional arguments are used for string
     * formating.
     * @returns Returns the current instance.
     */
    info(object:any, ...additionalArguments:Array<any>):Tools {
        return this.log(object, false, false, 'info', ...additionalArguments)
    }
    /**
     * Wrapper method for the native console method usually provided by
     * interpreter.
     * @param object - Any object to print.
     * @param additionalArguments - Additional arguments are used for string
     * formating.
     * @returns Returns the current instance.
     */
    debug(object:any, ...additionalArguments:Array<any>):Tools {
        return this.log(object, false, false, 'debug', ...additionalArguments)
    }
    /**
     * Wrapper method for the native console method usually provided by
     * interpreter.
     * @param object - Any object to print.
     * @param additionalArguments - Additional arguments are used for string
     * formating.
     * @returns Returns the current instance.
     */
    error(object:any, ...additionalArguments:Array<any>):Tools {
        return this.log(object, true, false, 'error', ...additionalArguments)
    }
    /**
     * Wrapper method for the native console method usually provided by
     * interpreter.
     * @param object - Any object to print.
     * @param additionalArguments - Additional arguments are used for string
     * formating.
     * @returns Returns the current instance.
     */
    critical(object:any, ...additionalArguments:Array<any>):Tools {
        return this.log(object, true, false, 'warn', ...additionalArguments)
    }
    /**
     * Wrapper method for the native console method usually provided by
     * interpreter.
     * @param object - Any object to print.
     * @param additionalArguments - Additional arguments are used for string
     * formating.
     * @returns Returns the current instance.
     */
    warn(object:any, ...additionalArguments:Array<any>):Tools {
        return this.log(object, false, false, 'warn', ...additionalArguments)
    }
    /**
     * Dumps a given object in a human readable format.
     * @param object - Any object to show.
     * @param level - Number of levels to dig into given object recursively.
     * @param currentLevel - Maximal number of recursive function calls to
     * represent given object.
     * @returns Returns the serialized version of given object.
     */
    static show(object:any, level:number = 3, currentLevel:number = 0):string {
        let output:string = ''
        if (Tools.determineType(object) === 'object') {
            for (const key:string in object)
                if (object.hasOwnProperty(key)) {
                    output += `${key.toString()}: `
                    if (currentLevel <= level)
                        output += Tools.show(
                            object[key], level, currentLevel + 1)
                    else
                        output += `${object[key]}`
                    output += '\n'
                }
            return output.trim()
        }
        output = `${object}`.trim()
        return `${output} (Type: "${Tools.determineType(object)}")`
    }
    // / endregion
    // / region cookie
    /**
     * Gets a cookie value by given name.
     * @param name - Name to identify requested value.
     * @returns Requested value.
     */
    static getCookie(name:string):string|null {
        if ('document' in $.global) {
            const key:string = `${name}=`
            const decodedCookie:string = decodeURIComponent(
                $.global.document.cookie)
            for (let date:string of decodedCookie.split(';')) {
                while (date.charAt(0) === ' ')
                    date = date.substring(1)
                if (date.indexOf(key) === 0)
                    return date.substring(key.length, date.length)
            }
        }
        return null
    }
    /**
     * Sets a cookie key-value-pair.
     * @param name - Name to identify given value.
     * @param value - Value to set.
     * @param numberOfDaysUntilExpiration - Number of days until given key
     * shouldn't be deleted.
     * @param path - Path to reference with given key-value-pair.
     * @returns A boolean indicating whether cookie could be set or not.
     */
    static setCookie(
        name:string,
        value:string,
        numberOfDaysUntilExpiration:number = 365,
        path:string = '/'
    ):boolean {
        if ('document' in $.global) {
            const now:Date = new Date()
            now.setTime(
                now.getTime() +
                (numberOfDaysUntilExpiration * 24 * 60 * 60 * 1000)
            )
            $.global.document.cookie =
                `${name}=${value};expires="${now.toUTCString()};path=${path}`
            return true
        }
        return false
    }
    // / endregion
    // / region dom node
    /**
     * Normalizes class name order of current dom node.
     * @returns Current instance.
     */
    get normalizedClassNames():Tools {
        if (this.$domNode) {
            const className:string = 'class'
            // IgnoreTypeCheck
            this.$domNode.find('*').addBack().each(function():void {
                const $thisDomNode:$DomNode = $(this)
                if ($thisDomNode.attr(className))
                    $thisDomNode.attr(className, ($thisDomNode.attr(
                        className
                    ).split(' ').sort() || []).join(' '))
                else if ($thisDomNode.is(`[${className}]`))
                    $thisDomNode.removeAttr(className)
            })
        }
        return this
    }
    /**
     * Normalizes style attributes order of current dom node.
     * @returns Returns current instance.
     */
    get normalizedStyles():Tools {
        if (this.$domNode) {
            const self:Tools = this
            const styleName:string = 'style'
            // IgnoreTypeCheck
            this.$domNode.find('*').addBack().each(function():void {
                const $thisDomNode:$DomNode = $(this)
                const serializedStyles:?string = $thisDomNode.attr(styleName)
                if (serializedStyles)
                    $thisDomNode.attr(
                        styleName, self.constructor.stringCompressStyleValue((
                            self.constructor.stringCompressStyleValue(
                                serializedStyles
                            ).split(';').sort() || []
                        ).map((style:string):string => style.trim()).join(
                            ';')))
                else if ($thisDomNode.is(`[${styleName}]`))
                    $thisDomNode.removeAttr(styleName)
            })
        }
        return this
    }
    /**
     * Retrieves a mapping of computed style attributes to their corresponding
     * values.
     * @returns The computed style mapping.
     */
    get style():PlainObject {
        const result:PlainObject = {}
        if ('window' in $.global && $.global.window.getComputedStyle) {
            const styleProperties:?any = $.global.window.getComputedStyle(
                this.$domNode[0], null)
            if (styleProperties) {
                if ('length' in styleProperties)
                    for (
                        let index:number = 0; index < styleProperties.length;
                        index += 1
                    )
                        result[this.constructor.stringDelimitedToCamelCase(
                            styleProperties[index]
                        )] = styleProperties.getPropertyValue(
                            styleProperties[index])
                else
                    for (const propertyName:string in styleProperties)
                        if (styleProperties.hasOwnProperty(propertyName))
                            result[this.constructor.stringDelimitedToCamelCase(
                                propertyName
                            )] = propertyName in styleProperties &&
                            styleProperties[
                                propertyName
                            ] || styleProperties.getPropertyValue(propertyName)
                return result
            }
        }
        let styleProperties:?PlainObject = this.$domNode[0].currentStyle
        if (styleProperties) {
            for (const propertyName:string in styleProperties)
                if (styleProperties.hasOwnProperty(propertyName))
                    result[propertyName] = styleProperties[propertyName]
            return result
        }
        styleProperties = this.$domNode[0].style
        if (styleProperties)
            for (const propertyName:string in styleProperties)
                if (typeof styleProperties[propertyName] !== 'function')
                    result[propertyName] = styleProperties[propertyName]
        return result
    }
    /**
     * Get text content of current element without it children's text contents.
     * @returns The text string.
     */
    get text():string {
        return this.$domNode.clone().children().remove().end().text()
    }
    /**
     * Checks whether given html or text strings are equal.
     * @param first - First html, selector to dom node or text to compare.
     * @param second - Second html, selector to dom node  or text to compare.
     * @param forceHTMLString - Indicates whether given contents are
     * interpreted as html string (otherwise an automatic detection will be
     * triggered).
     * @returns Returns true if both dom representations are equivalent.
     */
    static isEquivalentDOM(
        first:any, second:any, forceHTMLString:boolean = false
    ):boolean {
        if (first === second)
            return true
        if (first && second) {
            const detemermineHTMLPattern:RegExp =
                /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/
            const inputs:{first:any;second:any} = {first, second}
            const $domNodes:{first:$DomNode;second:$DomNode} = {
                first: $('<dummy>'), second: $('<dummy>')
            }
            /*
                NOTE: Assume that strings that start "<" and end with ">" are
                markup and skip the more expensive regular expression check.
            */
            for (const type:string of ['first', 'second'])
                if (typeof inputs[type] === 'string' && (forceHTMLString || (
                    inputs[type].startsWith('<') &&
                    inputs[type].endsWith('>') && inputs[type].length >= 3 ||
                    detemermineHTMLPattern.test(inputs[type])
                )))
                    $domNodes[type] = $(`<div>${inputs[type]}</div>`)
                else
                    try {
                        const $selectedDomNode:$DomNode = $(inputs[type])
                        if ($selectedDomNode.length)
                            $domNodes[type] = $('<div>').append(
                                $selectedDomNode.clone())
                        else
                            return false
                    } catch (error) {
                        return false
                    }
            if (
                $domNodes.first.length &&
                $domNodes.first.length === $domNodes.second.length
            ) {
                $domNodes.first = $domNodes.first.Tools(
                    'normalizedClassNames'
                ).$domNode.Tools('normalizedStyles').$domNode
                $domNodes.second = $domNodes.second.Tools(
                    'normalizedClassNames'
                ).$domNode.Tools('normalizedStyles').$domNode
                let index:number = 0
                for (const domNode:DomNode of $domNodes.first) {
                    if (!domNode.isEqualNode($domNodes.second[index]))
                        return false
                    index += 1
                }
                return true
            }
        }
        return false
    }
    /**
     * Determines where current dom node is relative to current view port
     * position.
     * @param delta - Allows deltas for "top", "left", "bottom" and "right" for
     * determining positions.
     * @returns Returns one of "above", "left", "below", "right" or "in".
     */
    getPositionRelativeToViewport(delta:Position = {}):RelativePosition {
        delta = this.constructor.extend(
            {top: 0, left: 0, bottom: 0, right: 0}, delta)
        if (
            'window' in $.global && this.$domNode && this.$domNode.length &&
            this.$domNode[0]
        ) {
            const $window:$DomNode = $($.global.window)
            const rectangle:Position = this.$domNode[0].getBoundingClientRect()
            if ((rectangle.top + delta.top) < 0)
                return 'above'
            if ((rectangle.left + delta.left) < 0)
                return 'left'
            if ($window.height() < (rectangle.bottom + delta.bottom))
                return 'below'
            if ($window.width() < (rectangle.right + delta.right))
                return 'right'
        }
        return 'in'
    }
    /**
     * Generates a directive name corresponding selector string.
     * @param directiveName - The directive name.
     * @returns Returns generated selector.
     */
    static generateDirectiveSelector(directiveName:string):string {
        const delimitedName:string = Tools.stringCamelCaseToDelimited(
            directiveName)
        return `${delimitedName}, .${delimitedName}, [${delimitedName}], ` +
            `[data-${delimitedName}], [x-${delimitedName}]` + (
            (delimitedName.includes('-') ? (
                `, [${delimitedName.replace(/-/g, '\\:')}], ` +
                `[${delimitedName.replace(/-/g, '_')}]`) : ''))
    }
    /**
     * Removes a directive name corresponding class or attribute.
     * @param directiveName - The directive name.
     * @returns Returns current dom node.
     */
    removeDirective(directiveName:string):$DomNode {
        const delimitedName:string =
            this.constructor.stringCamelCaseToDelimited(directiveName)
        return this.$domNode.removeClass(delimitedName).removeAttr(
            delimitedName
        ).removeAttr(`data-${delimitedName}`).removeAttr(
            `x-${delimitedName}`
        ).removeAttr(delimitedName.replace('-', ':')).removeAttr(
            delimitedName.replace('-', '_'))
    }
    /**
     * Determines a normalized camel case directive name representation.
     * @param directiveName - The directive name.
     * @returns Returns the corresponding name.
     */
    static getNormalizedDirectiveName(directiveName:string):string {
        for (const delimiter:string of ['-', ':', '_']) {
            let prefixFound:boolean = false
            for (const prefix:string of [`data${delimiter}`, `x${delimiter}`])
                if (directiveName.startsWith(prefix)) {
                    directiveName = directiveName.substring(prefix.length)
                    prefixFound = true
                    break
                }
            if (prefixFound)
                break
        }
        for (const delimiter:string of ['-', ':', '_'])
            directiveName = Tools.stringDelimitedToCamelCase(
                directiveName, delimiter)
        return directiveName
    }
    /**
     * Determines a directive attribute value.
     * @param directiveName - The directive name.
     * @returns Returns the corresponding attribute value or "null" if no
     * attribute value exists.
     */
    getDirectiveValue(directiveName:string):?string {
        const delimitedName:string =
            this.constructor.stringCamelCaseToDelimited(directiveName)
        for (const attributeName:string of [
            delimitedName, `data-${delimitedName}`, `x-${delimitedName}`,
            delimitedName.replace('-', '\\:')
        ]) {
            const value:string = this.$domNode.attr(attributeName)
            if (value !== undefined)
                return value
        }
        return null
    }
    /**
     * Removes a selector prefix from a given selector. This methods searches
     * in the options object for a given "domNodeSelectorPrefix".
     * @param domNodeSelector - The dom node selector to slice.
     * @returns Returns the sliced selector.
     */
    sliceDomNodeSelectorPrefix(domNodeSelector:string):string {
        if (
            'domNodeSelectorPrefix' in this._options &&
            domNodeSelector.startsWith(this._options.domNodeSelectorPrefix)
        )
            return domNodeSelector.substring(
                this._options.domNodeSelectorPrefix.length
            ).trim()
        return domNodeSelector
    }
    /**
     * Determines the dom node name of a given dom node string.
     * @param domNodeSelector - A given to dom node selector to determine its
     * name.
     * @returns Returns The dom node name.
     * @example
     * // returns 'div'
     * $.Tools.getDomNodeName('&lt;div&gt;')
     * @example
     * // returns 'div'
     * $.Tools.getDomNodeName('&lt;div&gt;&lt;/div&gt;')
     * @example
     * // returns 'br'
     * $.Tools.getDomNodeName('&lt;br/&gt;')
     */
    static getDomNodeName(domNodeSelector:string):?string {
        const match:?Array<string> = domNodeSelector.match(
            new RegExp('^<?([a-zA-Z]+).*>?.*'))
        if (match)
            return match[1]
        return null
    }
    /* eslint-disable jsdoc/require-description-complete-sentence */
    /**
     * Converts an object of dom selectors to an array of $ wrapped dom nodes.
     * Note if selector description as one of "class" or "id" as suffix element
     * will be ignored.
     * @param domNodeSelectors - An object with dom node selectors.
     * @param wrapperDomNode - A dom node to be the parent or wrapper of all
     * retrieved dom nodes.
     * @returns Returns All $ wrapped dom nodes corresponding to given
     * selectors.
     */
    grabDomNode(
        domNodeSelectors:PlainObject, wrapperDomNode:DomNode|$DomNode
    ):{[key:string]:$DomNode} {
    /* eslint-enable jsdoc/require-description-complete-sentence */
        const domNodes:{[key:string]:$DomNode} = {}
        if (domNodeSelectors)
            if (wrapperDomNode) {
                const $wrapperDomNode:$DomNode = $(wrapperDomNode)
                for (const name:string in domNodeSelectors)
                    if (domNodeSelectors.hasOwnProperty(name))
                        domNodes[name] = $wrapperDomNode.find(
                            domNodeSelectors[name])
            } else
                for (const name:string in domNodeSelectors)
                    if (domNodeSelectors.hasOwnProperty(name)) {
                        const match:?Array<string> =
                            domNodeSelectors[name].match(', *')
                        if (match)
                            domNodeSelectors[name] += domNodeSelectors[
                                name
                            ].split(match[0]).map((
                                selectorPart:string
                            ):string =>
                                ', ' + this.stringNormalizeDomNodeSelector(
                                    selectorPart)
                            ).join('')
                        domNodes[name] = $(this.stringNormalizeDomNodeSelector(
                            domNodeSelectors[name]))
                    }
        if (this._options.domNodeSelectorPrefix)
            domNodes.parent = $(this._options.domNodeSelectorPrefix)
        if ('window' in $.global)
            domNodes.window = $($.global.window)
        if ('document' in $.global)
            domNodes.document = $($.global.document)
        return domNodes
    }
    // / endregion
    // / region scope
    /**
     * Overwrites all inherited variables from parent scope with "undefined".
     * @param scope - A scope where inherited names will be removed.
     * @param prefixesToIgnore - Name prefixes to ignore during deleting names
     * in given scope.
     * @returns The isolated scope.
     */
    static isolateScope(
        scope:Object, prefixesToIgnore:Array<string> = []
    ):Object {
        for (const name:string in scope)
            if (!(prefixesToIgnore.includes(name.charAt(0)) || [
                'this', 'constructor'
            ].includes(name) || scope.hasOwnProperty(name)))
                /*
                    NOTE: Delete ("delete $scope[name]") doesn't destroy the
                    automatic lookup to parent scope.
                */
                scope[name] = undefined
        return scope
    }
    /**
     * Generates a unique name in given scope (useful for jsonp requests).
     * @param prefix - A prefix which will be prepended to unique name.
     * @param suffix - A suffix which will be prepended to unique name.
     * @param scope - A scope where the name should be unique.
     * @param initialUniqueName - An initial scope name to use if not exists.
     * @returns The function name.
     */
    static determineUniqueScopeName(
        prefix:string = 'callback', suffix:string = '',
        scope:Object = $.global, initialUniqueName:string = ''
    ):string {
        if (initialUniqueName.length && !(initialUniqueName in scope))
            return initialUniqueName
        let uniqueName:string = prefix + suffix
        while (true) {
            uniqueName = prefix + parseInt(Math.random() * Math.pow(
                10, 10
            ), 10) + suffix
            if (!(uniqueName in scope))
                break
        }
        return uniqueName
    }
    // / endregion
    // / region function
    /**
     * Determines all parameter names from given callable (function or class,
     * ...).
     * @param callable - Function or function code to inspect.
     * @returns List of parameter names.
     */
    static getParameterNames(callable:Function|string):Array<string> {
        const functionCode:string = ((
            typeof callable === 'string'
        ) ? callable : callable.toString()).replace(
            // Strip comments.
            /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg, '')
        if (functionCode.startsWith('class'))
            return Tools.getParameterNames('function ' + functionCode.replace(
                /.*(constructor\([^)]+\))/m, '$1'))
        // Try classic function declaration.
        let parameter:?Array<string> = functionCode.match(
            /^function\s*[^\(]*\(\s*([^\)]*)\)/m)
        if (parameter === null)
            // Try arrow function declaration.
            parameter = functionCode.match(/^[^\(]*\(\s*([^\)]*)\) *=>.*/m)
        if (parameter === null)
            // Try one argument and without brackets arrow function declaration.
            parameter = functionCode.match(/([^= ]+) *=>.*/m)
        const names:Array<string> = []
        if (parameter && parameter.length > 1 && parameter[1].trim().length) {
            for (const name:string of parameter[1].split(','))
                // Remove default parameter values.
                names.push(name.replace(/=.+$/g, '').trim())
            return names
        }
        return names
    }
    /**
     * Implements the identity function.
     * @param value - A value to return.
     * @returns Returns the given value.
     */
    static identity(value:any):any {
        return value
    }
    /**
     * Inverted filter helper to inverse each given filter.
     * @param filter - A function that filters an array.
     * @returns The inverted filter.
     */
    static invertArrayFilter(filter:Function):Function {
        return function(data:any, ...additionalParameter:Array<any>):any {
            if (data) {
                const filteredData:any = filter.call(
                    this, data, ...additionalParameter)
                let result:Array<any> = []
                /* eslint-disable curly */
                if (filteredData.length) {
                    for (const date:any of data)
                        if (!filteredData.includes(date))
                            result.push(date)
                } else
                /* eslint-enable curly */
                    result = data
                return result
            }
            return data
        }
    }
    /**
     * Triggers given callback after given duration. Supports unlimited
     * duration length and returns a promise which will be resolved after given
     * duration has been passed.
     * @param parameter - Observes the first three existing parameter. If one
     * is a number it will be interpret as delay in milliseconds until given
     * callback will be triggered. If one is of type function it will be used
     * as callback and if one is of type boolean it will indicate if returning
     * promise should be rejected or resolved if given internally created
     * timeout should be canceled. Additional parameter will be forwarded to
     * given callback.
     * @returns A promise resolving after given delay or being rejected if
     * value "true" is within one of the first three parameter. The promise
     * holds a boolean indicating whether timeout has been canceled or
     * resolved.
     */
    static timeout(...parameter:Array<any>):Promise<boolean> {
        let callback:Function = Tools.noop
        let delayInMilliseconds:number = 0
        let throwOnTimeoutClear:boolean = false
        for (const value:any of parameter)
            if (typeof value === 'number' && !Number.isNaN(value))
                delayInMilliseconds = value
            else if (typeof value === 'boolean')
                throwOnTimeoutClear = value
            else if (Tools.isFunction(value))
                callback = value
        let rejectCallback:Function
        let resolveCallback:Function
        const result:Promise<boolean> = new Promise((
            resolve:Function, reject:Function
        ):void => {
            rejectCallback = reject
            resolveCallback = resolve
        })
        const wrappedCallback:Function = ():void => {
            callback.call(result, ...parameter)
            resolveCallback(false)
        }
        const maximumTimeoutDelayInMilliseconds:number = 2147483647
        if (delayInMilliseconds <= maximumTimeoutDelayInMilliseconds)
            // IgnoreTypeCheck
            result.timeoutID = setTimeout(wrappedCallback, delayInMilliseconds)
        else {
            /*
                Determine the number of times we need to delay by maximum
                possible timeout duration.
            */
            let numberOfRemainingTimeouts:number = Math.floor(
                delayInMilliseconds / maximumTimeoutDelayInMilliseconds)
            const finalTimeoutDuration:number = delayInMilliseconds %
                maximumTimeoutDelayInMilliseconds
            const delay:Function = ():void => {
                if (numberOfRemainingTimeouts > 0) {
                    numberOfRemainingTimeouts -= 1
                    // IgnoreTypeCheck
                    result.timeoutID = setTimeout(
                        delay, maximumTimeoutDelayInMilliseconds)
                } else
                    // IgnoreTypeCheck
                    result.timeoutID = setTimeout(
                        wrappedCallback, finalTimeoutDuration)
            }
            delay()
        }
        // IgnoreTypeCheck
        result.clear = ():void => {
            // IgnoreTypeCheck
            if (result.timeoutID) {
                // IgnoreTypeCheck
                clearTimeout(result.timeoutID);
                (throwOnTimeoutClear ? rejectCallback : resolveCallback)(true)
            }
        }
        return result
    }
    // / endregion
    // / region event
    /**
     * Prevents event functions from triggering to often by defining a minimal
     * span between each function call. Additional arguments given to this
     * function will be forwarded to given event function call. The function
     * wrapper returns null if current function will be omitted due to
     * debounceing.
     * @param eventFunction - The function to call debounced.
     * @param thresholdInMilliseconds - The minimum time span between each
     * function call.
     * @param additionalArguments - Additional arguments to forward to given
     * function.
     * @returns Returns the wrapped method.
     */
    static debounce(
        eventFunction:Function, thresholdInMilliseconds:number = 600,
        ...additionalArguments:Array<any>
    ):Function {
        let lock:boolean = false
        let waitingCallArguments:?Array<any> = null
        let timer:?Promise<boolean> = null
        return (...parameter:Array<any>):?Promise<boolean> => {
            parameter = parameter.concat(additionalArguments || [])
            if (lock)
                waitingCallArguments = parameter
            else {
                lock = true
                eventFunction(...parameter)
                timer = Tools.timeout(thresholdInMilliseconds, ():void => {
                    lock = false
                    if (waitingCallArguments) {
                        eventFunction(...waitingCallArguments)
                        waitingCallArguments = null
                    }
                })
            }
            return timer
        }
    }
    /**
     * Searches for internal event handler methods and runs them by default. In
     * addition this method searches for a given event method by the options
     * object. Additional arguments are forwarded to respective event
     * functions.
     * @param eventName - An event name.
     * @param callOnlyOptionsMethod - Prevents from trying to call an internal
     * event handler.
     * @param scope - The scope from where the given event handler should be
     * called.
     * @param additionalArguments - Additional arguments to forward to
     * corresponding event handlers.
     * @returns - Returns "true" if an options event handler was called and
     * "false" otherwise.
     */
    fireEvent(
        eventName:string, callOnlyOptionsMethod:boolean = false,
        scope:any = this, ...additionalArguments:Array<any>
    ):any {
        const eventHandlerName:string =
            `on${this.constructor.stringCapitalize(eventName)}`
        if (!callOnlyOptionsMethod)
            if (eventHandlerName in scope)
                scope[eventHandlerName](...additionalArguments)
            else if (`_${eventHandlerName}` in scope)
                scope[`_${eventHandlerName}`](...additionalArguments)
        if (
            scope._options && eventHandlerName in scope._options &&
            scope._options[eventHandlerName] !== this.constructor.noop
        )
            return scope._options[eventHandlerName].call(
                this, ...additionalArguments)
        return true
    }
    /* eslint-disable jsdoc/require-description-complete-sentence */
    /**
     * A wrapper method for "$.on()". It sets current plugin name as event
     * scope if no scope is given. Given arguments are modified and passed
     * through "$.on()".
     * @param parameter - Parameter to forward.
     * @returns Returns $'s grabbed dom node.
     */
    on(...parameter:Array<any>):$DomNode {
    /* eslint-enable jsdoc/require-description-complete-sentence */
        return this._bindEventHelper(parameter, false)
    }
    /* eslint-disable jsdoc/require-description-complete-sentence */
    /**
     * A wrapper method fo "$.off()". It sets current plugin name as event
     * scope if no scope is given. Given arguments are modified and passed
     * through "$.off()".
     * @param parameter - Parameter to forward.
     * @returns Returns $'s grabbed dom node.
     */
    off(...parameter:Array<any>):$DomNode {
    /* eslint-enable jsdoc/require-description-complete-sentence */
        return this._bindEventHelper(parameter, true, 'off')
    }
    // / endregion
    // / region object
    /**
     * Adds dynamic getter and setter to any given data structure such as maps.
     * @param object - Object to proxy.
     * @param getterWrapper - Function to wrap each property get.
     * @param setterWrapper - Function to wrap each property set.
     * @param methodNames - Method names to perform actions on the given
     * object.
     * @param deep - Indicates to perform a deep wrapping of specified types.
     * @param typesToExtend - Types which should be extended (Checks are
     * performed via "value instanceof type".).
     * @returns Returns given object wrapped with a dynamic getter proxy.
     */
    static addDynamicGetterAndSetter(
        object:any, getterWrapper:?GetterFunction = null,
        setterWrapper:?SetterFunction = null, methodNames:PlainObject = {},
        deep:boolean = true, typesToExtend:Array<mixed> = [Object]
    ):any {
        if (deep && typeof object === 'object')
            if (Array.isArray(object)) {
                let index:number = 0
                for (const value:any of object) {
                    object[index] = Tools.addDynamicGetterAndSetter(
                        value, getterWrapper, setterWrapper, methodNames, deep)
                    index += 1
                }
            } else if (Tools.determineType(object) === 'map')
                for (const [key:any, value:any] of object)
                    object.set(key, Tools.addDynamicGetterAndSetter(
                        value, getterWrapper, setterWrapper, methodNames, deep)
                    )
            else if (Tools.determineType(object) === 'set') {
                const cache:Array<any> = []
                for (const value:any of object) {
                    object.delete(value)
                    cache.push(Tools.addDynamicGetterAndSetter(
                        value, getterWrapper, setterWrapper, methodNames, deep)
                    )
                }
                for (const value:any of cache)
                    object.add(value)
            } else if (object !== null) {
                for (const key:string in object)
                    if (object.hasOwnProperty(key))
                        object[key] = Tools.addDynamicGetterAndSetter(
                            object[key], getterWrapper, setterWrapper,
                            methodNames, deep)
            }
        if (getterWrapper || setterWrapper)
            for (const type:mixed of typesToExtend)
                if (
                    typeof object === 'object' && object instanceof type &&
                    object !== null
                ) {
                    const defaultHandler = Tools.getProxyHandler(
                        object, methodNames)
                    const handler:Object = Tools.getProxyHandler(
                        object, methodNames)
                    if (getterWrapper)
                        handler.get = (proxy:Proxy<any>, name:string):any => {
                            if (name === '__target__')
                                return object
                            if (name === '__revoke__')
                                return ():any => {
                                    revoke()
                                    return object
                                }
                            if (typeof object[name] === 'function')
                                return object[name]
                            // IgnoreTypeCheck
                            return getterWrapper(
                                defaultHandler.get(proxy, name), name, object)
                        }
                    if (setterWrapper)
                        handler.set = (
                            proxy:Proxy<any>, name:string, value:any
                        // IgnoreTypeCheck
                        ):any => defaultHandler.set(proxy, name, setterWrapper(
                            name, value, object))
                    const {proxy, revoke} = Proxy.revocable({}, handler)
                    return proxy
                }
        return object
    }
    /**
     * Converts given object into its serialized json representation by
     * replacing circular references with a given provided value.
     * @param object - Object to serialize.
     * @param determineCicularReferenceValue - Callback to create a fallback
     * value depending on given redundant value.
     * @param numberOfSpaces - Number of spaces to use for string formatting.
     * @returns The formatted json string.
     */
    static convertCircularObjectToJSON(
        object:Object, determineCicularReferenceValue:((
            key:string, value:any, seenObjects:Array<any>
        ) => any) = ():string => '__circularReference__',
        numberOfSpaces:number = 0
    ):string {
        const seenObjects:Array<any> = []
        return JSON.stringify(object, (key:string, value:any):any => {
            if (typeof value === 'object' && value !== null) {
                if (seenObjects.includes(value))
                    return determineCicularReferenceValue(
                        key, value, seenObjects)
                seenObjects.push(value)
                return value
            }
            return value
        }, numberOfSpaces)
    }
    /**
     * Converts given map and all nested found maps objects to corresponding
     * object.
     * @param object - Map to convert to.
     * @param deep - Indicates whether to perform a recursive conversion.
     * @returns Given map as object.
     */
    static convertMapToPlainObject(object:any, deep:boolean = true):any {
        if (typeof object === 'object') {
            if (Tools.determineType(object) === 'map') {
                const newObject:PlainObject = {}
                for (let [key:any, value:any] of object) {
                    if (deep)
                        value = Tools.convertMapToPlainObject(value, deep)
                    newObject[`${key}`] = value
                }
                return newObject
            }
            if (deep)
                if (Tools.isPlainObject(object)) {
                    for (const key:string in object)
                        if (object.hasOwnProperty(key))
                            object[key] = Tools.convertMapToPlainObject(
                                object[key], deep)
                } else if (Array.isArray(object)) {
                    let index:number = 0
                    for (const value:any of object) {
                        object[index] = Tools.convertMapToPlainObject(
                            value, deep)
                        index += 1
                    }
                } else if (Tools.determineType(object) === 'set') {
                    const cache:Array<any> = []
                    for (const value:any of object) {
                        object.delete(value)
                        cache.push(Tools.convertMapToPlainObject(value, deep))
                    }
                    for (const value:any of cache)
                        object.add(value)
                }
        }
        return object
    }
    /**
     * Converts given plain object and all nested found objects to
     * corresponding map.
     * @param object - Object to convert to.
     * @param deep - Indicates whether to perform a recursive conversion.
     * @returns Given object as map.
     */
    static convertPlainObjectToMap(object:any, deep:boolean = true):any {
        if (typeof object === 'object') {
            if (Tools.isPlainObject(object)) {
                const newObject:Map<any, any> = new Map()
                for (const key:string in object)
                    if (object.hasOwnProperty(key)) {
                        if (deep)
                            object[key] = Tools.convertPlainObjectToMap(
                                object[key], deep)
                        newObject.set(key, object[key])
                    }
                return newObject
            }
            if (deep)
                if (Array.isArray(object)) {
                    let index:number = 0
                    for (const value:any of object) {
                        object[index] = Tools.convertPlainObjectToMap(
                            value, deep)
                        index += 1
                    }
                } else if (Tools.determineType(object) === 'map')
                    for (const [key:any, value:any] of object)
                        object.set(key, Tools.convertPlainObjectToMap(
                            value, deep))
                else if (Tools.determineType(object) === 'set') {
                    const cache:Array<any> = []
                    for (const value:any of object) {
                        object.delete(value)
                        cache.push(Tools.convertPlainObjectToMap(value, deep))
                    }
                    for (const value:any of cache)
                        object.add(value)
                }
        }
        return object
    }
    /**
     * Replaces given pattern in each value in given object recursively with
     * given string replacement.
     * @param object - Object to convert substrings in.
     * @param pattern - Regular expression to replace.
     * @param replacement - String to use as replacement for found patterns.
     * @returns Converted object with replaced patterns.
     */
    static convertSubstringInPlainObject(
        object:PlainObject, pattern:RegExp, replacement:string
    ):PlainObject {
        for (const key:string in object)
            if (object.hasOwnProperty(key))
                if (Tools.isPlainObject(object[key]))
                    object[key] = Tools.convertSubstringInPlainObject(
                        object[key], pattern, replacement)
                else if (typeof object[key] === 'string')
                    object[key] = object[key].replace(pattern, replacement)
        return object
    }
    /**
     * Copies given object (of any type) into optionally given destination.
     * @param source - Object to copy.
     * @param recursionLimit - Specifies how deep we should traverse into given
     * object recursively.
     * @param cyclic - Indicates whether known sub structures should be copied
     * or referenced (if "true" endless loops can occur of source has cyclic
     * structures).
     * @param destination - Target to copy source to.
     * @param stackSource - Internally used to avoid traversing loops.
     * @param stackDestination - Internally used to avoid traversing loops and
     * referencing them correctly.
     * @param recursionLevel - Internally used to track current recursion
     * level in given source data structure.
     * @returns Value "true" if both objects are equal and "false" otherwise.
     */
    static copy(
        source:any,
        recursionLimit:number = -1,
        cyclic:boolean = false,
        destination:any = null,
        stackSource:Array<any> = [],
        stackDestination:Array<any> = [],
        recursionLevel:number = 0
    ):any {
        if (typeof source === 'object')
            if (destination) {
                if (source === destination)
                    throw new Error(
                        `Can't copy because source and destination are ` +
                        `identical.`)
                if (recursionLimit !== -1 && recursionLimit < recursionLevel)
                    return null
                if (!cyclic && ![undefined, null].includes(source)) {
                    const index:number = stackSource.indexOf(source)
                    if (index !== -1)
                        return stackDestination[index]
                    stackSource.push(source)
                    stackDestination.push(destination)
                }
                const copyValue:Function = (value:any):any => {
                    const result:any = Tools.copy(
                        value, recursionLimit, cyclic, null, stackSource,
                        stackDestination, recursionLevel + 1)
                    if (
                        !cyclic &&
                        ![undefined, null].includes(value) &&
                        typeof value === 'object'
                    ) {
                        stackSource.push(value)
                        stackDestination.push(result)
                    }
                    return result
                }
                if (Array.isArray(source))
                    for (const item:any of source)
                        destination.push(copyValue(item))
                else if (Tools.determineType(source) === 'map')
                    for (const [key:any, value:any] of source)
                        destination.set(key, copyValue(value))
                else if (Tools.determineType(source) === 'set')
                    for (const value:any of source)
                        destination.add(copyValue(value))
                else if (source !== null)
                    for (const key:string in source)
                        if (source.hasOwnProperty(key))
                            destination[key] = copyValue(source[key])
            } else if (source) {
                if (Array.isArray(source))
                    return Tools.copy(
                        source, recursionLimit, cyclic, [], stackSource,
                        stackDestination, recursionLevel)
                if (Tools.determineType(source) === 'map')
                    return Tools.copy(
                        source, recursionLimit, cyclic, new Map(), stackSource,
                        stackDestination, recursionLevel)
                if (Tools.determineType(source) === 'set')
                    return Tools.copy(
                        source, recursionLimit, cyclic, new Set(), stackSource,
                        stackDestination, recursionLevel)
                if (Tools.determineType(source) === 'date')
                    return new Date(source.getTime())
                if (Tools.determineType(source) === 'regexp') {
                    destination = new RegExp(
                        source.source, source.toString().match(/[^\/]*$/)[0])
                    destination.lastIndex = source.lastIndex
                    return destination
                }
                return Tools.copy(
                    source, recursionLimit, cyclic, {}, stackSource,
                    stackDestination, recursionLevel)
            }
        return destination || source
    }
    /**
     * Determine the internal JavaScript [[Class]] of an object.
     * @param object - Object to analyze.
     * @returns Name of determined class.
     */
    static determineType(object:any = undefined):string {
        if ([undefined, null].includes(object))
            return `${object}`
        if (['object', 'function'].includes(
            typeof object
        ) && 'toString' in object) {
            const stringRepresentation:string =
                Tools.classToTypeMapping.toString.call(object)
            if (Tools.classToTypeMapping.hasOwnProperty(stringRepresentation))
                return Tools.classToTypeMapping[stringRepresentation]
        }
        return typeof object
    }
    /**
     * Returns true if given items are equal for given property list. If
     * property list isn't set all properties will be checked. All keys which
     * starts with one of the exception prefixes will be omitted.
     * @param firstValue - First object to compare.
     * @param secondValue - Second object to compare.
     * @param properties - Property names to check. Check all if "null" is
     * selected (default).
     * @param deep - Recursion depth negative values means infinitely deep
     * (default).
     * @param exceptionPrefixes - Property prefixes which indicates properties
     * to ignore.
     * @param ignoreFunctions - Indicates whether functions have to be
     * identical to interpret is as equal. If set to "true" two functions will
     * be assumed to be equal (default).
     * @param compareBlobs - Indicates whether binary data should be converted
     * to a base64 string to compare their content. Makes this function
     * asynchronous in browsers and potentially takes a lot of resources.
     * @returns Value "true" if both objects are equal and "false" otherwise.
     * If "compareBlobs" is activated and we're running in a browser like
     * environment and binary data is given, then a promise wrapping the
     * determined boolean values is returned.
     */
    static equals(
        firstValue:any,
        secondValue:any,
        properties:?Array<any> = null,
        deep:number = -1,
        exceptionPrefixes:Array<string> = [],
        ignoreFunctions:boolean = true,
        compareBlobs:boolean = false
    ):Promise<boolean>|boolean {
        if (
            ignoreFunctions &&
            Tools.isFunction(firstValue) &&
            Tools.isFunction(secondValue) ||
            firstValue === secondValue ||
            Tools.numberIsNotANumber(firstValue) &&
            Tools.numberIsNotANumber(secondValue) ||
            firstValue instanceof RegExp &&
            secondValue instanceof RegExp &&
            firstValue.toString() === secondValue.toString() ||
            firstValue instanceof Date &&
            secondValue instanceof Date && (
                isNaN(firstValue.getTime()) &&
                isNaN(secondValue.getTime()) ||
                !isNaN(firstValue.getTime()) &&
                !isNaN(secondValue.getTime()) &&
                firstValue.getTime() === secondValue.getTime()
            ) ||
            compareBlobs &&
            eval('typeof Buffer') !== 'undefined' &&
            eval('Buffer').isBuffer &&
            firstValue instanceof eval('Buffer') &&
            secondValue instanceof eval('Buffer') &&
            firstValue.toString('base64') === secondValue.toString('base64')
        )
            return true
        if (
            compareBlobs && typeof Blob !== 'undefined' &&
            firstValue instanceof Blob && secondValue instanceof Blob
        )
            return new Promise((resolve:Function):void => {
                const values:Array<string> = []
                for (const value:any of [firstValue, secondValue]) {
                    const fileReader:FileReader = new FileReader()
                    fileReader.onload = (event:Object):void => {
                        values.push(event.target.result)
                        if (values.length === 2)
                            resolve(values[0] === values[1])
                    }
                    fileReader.readAsDataURL(value)
                }
            })
        if (
            Tools.isPlainObject(firstValue) &&
            Tools.isPlainObject(secondValue) &&
            !(
                firstValue instanceof RegExp || secondValue instanceof RegExp
            ) ||
            Array.isArray(firstValue) &&
            Array.isArray(secondValue) &&
            firstValue.length === secondValue.length ||
            (
                (
                    Tools.determineType(firstValue) === 'map' &&
                    Tools.determineType(secondValue) === 'map' ||
                    Tools.determineType(firstValue) === 'set' &&
                    Tools.determineType(secondValue) === 'set'
                ) &&
                firstValue.size === secondValue.size
            )
        ) {
            const promises:Array<Promise<boolean>> = []
            for (const [first, second] of [
                [firstValue, secondValue],
                [secondValue, firstValue]
            ]) {
                const firstIsArray:boolean = Array.isArray(first)
                if (
                    firstIsArray &&
                    (!Array.isArray(second) || first.length !== second.length)
                )
                    return false
                const firstIsMap:boolean = Tools.determineType(first) === 'map'
                if (
                    firstIsMap &&
                    (
                        Tools.determineType(second) !== 'map' ||
                        first.size !== second.size
                    )
                )
                    return false
                const firstIsSet:boolean = Tools.determineType(first) === 'set'
                if (
                    firstIsSet &&
                    (
                        Tools.determineType(second) !== 'set' ||
                        first.size !== second.size
                    )
                )
                    return false
                if (firstIsArray) {
                    let index:number = 0
                    for (const value:any of first) {
                        if (deep !== 0) {
                            const result:any = Tools.equals(
                                value,
                                second[index],
                                properties,
                                deep - 1,
                                exceptionPrefixes,
                                ignoreFunctions,
                                compareBlobs
                            )
                            if (!result)
                                return false
                            else if (
                                typeof result === 'object' && 'then' in result
                            )
                                promises.push(result)
                        }
                        index += 1
                    }
                /* eslint-disable curly */
                } else if (firstIsMap) {
                    for (const [key:any, value:any] of first)
                        if (deep !== 0) {
                            const result:any = Tools.equals(
                                value,
                                second.get(key),
                                properties,
                                deep - 1,
                                exceptionPrefixes,
                                ignoreFunctions,
                                compareBlobs
                            )
                            if (!result)
                                return false
                            else if (
                                typeof result === 'object' && 'then' in result
                            )
                                promises.push(result)
                        }
                } else if (firstIsSet) {
                /* eslint-enable curly */
                    for (const value:any of first)
                        if (deep !== 0) {
                            let equal:boolean = false
                            const subPromises:Array<Promise<boolean>> = []
                            for (const secondValue:any of second) {
                                const result:any = Tools.equals(
                                    value,
                                    secondValue,
                                    properties,
                                    deep - 1,
                                    exceptionPrefixes,
                                    ignoreFunctions,
                                    compareBlobs
                                )
                                if (typeof result === 'boolean') {
                                    if (result) {
                                        equal = true
                                        break
                                    }
                                } else
                                    subPromises.push(result)
                            }
                            if (subPromises.length)
                                promises.push(new Promise(async (
                                    resolve:Function
                                ):Promise<void> => resolve((await Promise.all(
                                    subPromises
                                )).some(Tools.identity))))
                            else if (!equal)
                                return false
                        }
                } else
                    for (const key:string in first)
                        if (first.hasOwnProperty(key)) {
                            if (properties && !properties.includes(key))
                                break
                            let doBreak:boolean = false
                            for (
                                const exceptionPrefix:string of
                                exceptionPrefixes
                            )
                                if (key.toString().startsWith(
                                    exceptionPrefix
                                )) {
                                    doBreak = true
                                    break
                                }
                            if (doBreak)
                                break
                            if (deep !== 0) {
                                const result:any = Tools.equals(
                                    first[key],
                                    second[key],
                                    properties,
                                    deep - 1,
                                    exceptionPrefixes,
                                    ignoreFunctions,
                                    compareBlobs
                                )
                                if (!result)
                                    return false
                                else if (
                                    typeof result === 'object' &&
                                    'then' in result
                                )
                                    promises.push(result)
                            }
                        }
            }
            if (promises.length)
                return new Promise(async (resolve:Function):Promise<void> =>
                    resolve((await Promise.all(promises)).every(
                        Tools.identity)))
            return true
        }
        return false
    }
    /**
     * Searches for nested mappings with given indicator key and resolves
     * marked values. Additionally all objects are wrapped with a proxy to
     * dynamically resolve nested properties.
     * @param object - Given mapping to resolve.
     * @param scope - Scope to to use evaluate again.
     * @param selfReferenceName - Name to use for reference to given object.
     * @param expressionIndicatorKey - Indicator property name to mark a value
     * to evaluate.
     * @param executionIndicatorKey - Indicator property name to mark a value
     * to evaluate.
     * @returns Evaluated given mapping.
     */
    static evaluateDynamicDataStructure(
        object:any,
        scope:{[key:string]:any} = {},
        selfReferenceName:string = 'self',
        expressionIndicatorKey:string = '__evaluate__',
        executionIndicatorKey:string = '__execute__'
    ):any {
        if (typeof object !== 'object' || object === null)
            return object
        if (!(selfReferenceName in scope))
            scope[selfReferenceName] = object
        const evaluate:Function = (
            code:string, type:string = expressionIndicatorKey
        ):any => {
            code = (type === expressionIndicatorKey) ? `return ${code}` : code
            let compiledFunction:Function
            try {
                /* eslint-disable new-parens */
                // IgnoreTypeCheck
                compiledFunction = new (Function.prototype.bind.call(
                /* eslint-enable new-parens */
                    Function, null, ...Object.keys(scope), code))
            } catch (error) {
                throw new Error(
                    `Error during compiling code "${code}": "` +
                    `${Tools.representObject(error)}".`)
            }
            try {
                return compiledFunction(...Object.values(scope))
            } catch (error) {
                throw new Error(
                    `Error running code "${code}" in scope with variables "` +
                    `${Object.keys(scope).join('", "')}": "` +
                    `${Tools.representObject(error)}".`
                )
            }
        }
        const addProxyRecursively:Function = (data:any):any => {
            if (typeof data !== 'object' || data === null)
                return data
            for (const key:string in data)
                if (
                    data.hasOwnProperty(key) && key !== '__target__' &&
                    typeof data[key] === 'object' && data[key] !== null
                ) {
                    addProxyRecursively(data[key])
                    /*
                        NOTE: We only wrap needed objects for performance
                        reasons.
                    */
                    if (
                        data[key].hasOwnProperty(expressionIndicatorKey) ||
                        data[key].hasOwnProperty(executionIndicatorKey)
                    )
                        data[key] = new Proxy(data[key], {
                            get: (target:any, key:any):any => {
                                if (key === '__target__')
                                    return target
                                if (key === 'hasOwnProperty')
                                    return target[key]
                                /*
                                    NOTE: Very complicated stuff section, only
                                    change while doing a lot of tests.
                                */
                                for (const type:string of [
                                    expressionIndicatorKey,
                                    executionIndicatorKey
                                ])
                                    if (key === type)
                                        return resolve(evaluate(
                                            target[key], type))
                                const resolvedTarget:any = resolve(target)
                                if (key === 'toString') {
                                    const result:any = evaluate(resolvedTarget)
                                    return result[key].bind(result)
                                }
                                if (typeof key !== 'string') {
                                    const result:any = evaluate(resolvedTarget)
                                    if (result[key] && result[key].call)
                                        return result[key].bind(result)
                                    return result[key]
                                }
                                for (const type:string of [
                                    expressionIndicatorKey,
                                    executionIndicatorKey
                                ])
                                    if (target.hasOwnProperty(type))
                                        return evaluate(
                                            resolvedTarget, type
                                        )[key]
                                return resolvedTarget[key]
                                // End of complicated stuff.
                            },
                            ownKeys: (target:any):Array<string> => {
                                for (const type:string of [
                                    expressionIndicatorKey,
                                    executionIndicatorKey
                                ])
                                    if (target.hasOwnProperty(type))
                                        return Object.getOwnPropertyNames(
                                            resolve(evaluate(
                                                target[type], type)))
                                return Object.getOwnPropertyNames(target)
                            }
                        })
                }
            return data
        }
        const resolve:Function = (data:any):any => {
            if (typeof data === 'object' && data !== null) {
                if (data.__target__) {
                    // NOTE: We have to skip "ownKeys" proxy trap here.
                    for (const type:string of [
                        expressionIndicatorKey, executionIndicatorKey
                    ])
                        if (data.hasOwnProperty(type))
                            return data[type]
                    data = data.__target__
                }
                for (const key:string in data)
                    if (data.hasOwnProperty(key))
                        if ([
                            expressionIndicatorKey, executionIndicatorKey
                        ].includes(key))
                            return data[key]
                        else
                            data[key] = resolve(data[key])
            }
            return data
        }
        scope.resolve = resolve
        const removeProxyRecursively:Function = (data:any):any => {
            if (typeof data === 'object' && data !== null)
                for (const key:string in data)
                    if (
                        data.hasOwnProperty(key) && key !== '__target__' &&
                        typeof data[key] === 'object' && data[key] !== null
                    ) {
                        const target:any = data[key].__target__
                        if (typeof target !== 'undefined')
                            data[key] = target
                        removeProxyRecursively(data[key])
                    }
            return data
        }
        if (typeof object === 'object' && object !== null)
            if (object.hasOwnProperty(expressionIndicatorKey))
                return evaluate(object[expressionIndicatorKey])
            else if (object.hasOwnProperty(executionIndicatorKey))
                return evaluate(
                    object[executionIndicatorKey], executionIndicatorKey)
        return removeProxyRecursively(resolve(addProxyRecursively(object)))
    }
    /**
     * Extends given target object with given sources object. As target and
     * sources many expandable types are allowed but target and sources have to
     * to come from the same type.
     * @param targetOrDeepIndicator - Maybe the target or deep indicator.
     * @param targetAndOrSources - Target and at least one source object.
     * @returns Returns given target extended with all given sources.
     */
    static extend(
        targetOrDeepIndicator:boolean|any, ...targetAndOrSources:Array<any>
    ):any {
        let index:number = 0
        let deep:boolean = false
        let target:mixed
        if (typeof targetOrDeepIndicator === 'boolean') {
            // Handle a deep copy situation and skip deep indicator and target.
            deep = targetOrDeepIndicator
            target = targetAndOrSources[index]
            index = 1
        } else
            target = targetOrDeepIndicator
        const mergeValue = (targetValue:any, value:any):any => {
            if (value === targetValue)
                return targetValue
            // Recurse if we're merging plain objects or maps.
            if (deep && value && (Tools.isPlainObject(
                value
            ) || Tools.determineType(value) === 'map')) {
                let clone:any
                if (Tools.determineType(value) === 'map')
                    clone = (
                        targetValue &&
                        Tools.determineType(targetValue) === 'map'
                    ) ? targetValue : new Map()
                else
                    clone = (
                        targetValue &&
                        Tools.isPlainObject(targetValue)
                    ) ? targetValue : {}
                return Tools.extend(deep, clone, value)
            }
            return value
        }
        while (index < targetAndOrSources.length) {
            const source:any = targetAndOrSources[index]
            let targetType:string = typeof target
            let sourceType:string = typeof source
            if (Tools.determineType(target) === 'map')
                targetType += ' Map'
            if (Tools.determineType(source) === 'map')
                sourceType += ' Map'
            if (targetType === sourceType && target !== source)
                if (
                    Tools.determineType(target) === 'map' &&
                    Tools.determineType(source) === 'map'
                )
                    for (const [key:any, value:any] of source)
                        target.set(key, mergeValue(target.get(key), value))
                else if (
                    target !== null &&
                    !Array.isArray(target) &&
                    typeof target === 'object' &&
                    source !== null &&
                    !Array.isArray(source) &&
                    typeof source === 'object'
                ) {
                    for (const key:string in source)
                        if (source.hasOwnProperty(key))
                            target[key] = mergeValue(target[key], source[key])
                } else
                    target = source
            else
                target = source
            index += 1
        }
        return target
    }
    /**
     * Retrieves substructure in given object referenced by given selector
     * path.
     * @param target - Object to search in.
     * @param selector - Selector path.
     * @param delimiter - Delimiter to delimit given selector components.
     * @returns Determined sub structure of given data or "undefined".
     */
    static getSubstructure(
        target:any, selector:Array<string>|string, delimiter:string = '.'
    ):any {
        let path:Array<string> = []
        for (const component:string of [].concat(selector))
            path = path.concat(component.split(delimiter))
        let result:any = target
        for (const name:string of path)
            if (
                result !== null &&
                typeof result === 'object' &&
                result.hasOwnProperty(name)
            )
                result = result[name]
        return result
    }
    /**
     * Generates a proxy handler which forwards all operations to given object
     * as there wouldn't be a proxy.
     * @param target - Object to proxy.
     * @param methodNames - Mapping of operand name to object specific method
     * name.
     * @returns Determined proxy handler.
     */
    static getProxyHandler(
        target:any, methodNames:{[key:string]:string} = {}
    ):Object {
        methodNames = Tools.extend(
            {
                delete: '[]',
                get: '[]',
                has: '[]',
                set: '[]'
            },
            methodNames
        )
        return {
            deleteProperty: (proxy:Proxy<any>, key:any):any => {
                if (methodNames.delete === '[]')
                    delete target[key]
                else
                    return target[methodNames.delete](key)
            },
            get: (proxy:Proxy<any>, key:any):any => {
                if (methodNames.get === '[]')
                    return target[key]
                return target[methodNames.get](key)
            },
            has: (proxy:Proxy<any>, key:any):any => {
                if (methodNames.has === '[]')
                    return key in target
                return target[methodNames.has](key)
            },
            set: (proxy:Proxy<any>, key:any, value:any):any => {
                if (methodNames.set === '[]')
                    target[key] = value
                else
                    return target[methodNames.set](value)
            }
        }
    }
    /**
     * Modifies given target corresponding to given source and removes source
     * modification infos.
     * @param target - Object to modify.
     * @param source - Source object to load modifications from.
     * @param removeIndicatorKey - Indicator property name or value to mark a
     * value to remove from object or list.
     * @param prependIndicatorKey - Indicator property name to mark a value to
     * prepend to target list.
     * @param appendIndicatorKey - Indicator property name to mark a value to
     * append to target list.
     * @param positionPrefix - Indicates a prefix to use a value on given
     * position to add or remove.
     * @param positionSuffix - Indicates a suffix to use a value on given
     * position to add or remove.
     * @param parentSource - Source context to remove modification info from
     * (usually only needed internally).
     * @param parentKey - Source key in given source context to remove
     * modification info from (usually only needed internally).
     * @returns Given target modified with given source.
     */
    static modifyObject(
        target:any,
        source:any,
        removeIndicatorKey:string = '__remove__',
        prependIndicatorKey:string = '__prepend__',
        appendIndicatorKey:string = '__append__',
        positionPrefix:string = '__',
        positionSuffix:string = '__',
        parentSource:any = null,
        parentKey:any = null
    ):any {
        /* eslint-disable curly */
        if (
            Tools.determineType(source) === 'map' &&
            Tools.determineType(target) === 'map'
        ) {
            for (const [key:string, value:any] of source)
                if (target.has(key))
                    Tools.modifyObject(
                        target.get(key),
                        value,
                        removeIndicatorKey,
                        prependIndicatorKey,
                        appendIndicatorKey,
                        positionPrefix,
                        positionSuffix,
                        source,
                        key
                    )
        } else if (
        /* eslint-enable curly */
            source !== null &&
            typeof source === 'object' &&
            target !== null &&
            typeof target === 'object'
        )
            for (const key:string in source)
                if (source.hasOwnProperty(key))
                    if ([
                        removeIndicatorKey,
                        prependIndicatorKey,
                        appendIndicatorKey
                    ].includes(key)) {
                        if (Array.isArray(target))
                            if (key === removeIndicatorKey) {
                                for (const valueToModify:any of [].concat(
                                    source[key]
                                ))
                                    if (
                                        typeof valueToModify === 'string' &&
                                        valueToModify.startsWith(
                                            positionPrefix) &&
                                        valueToModify.endsWith(positionSuffix)
                                    )
                                        target.splice(
                                            parseInt(valueToModify.substring(
                                                positionPrefix.length,
                                                valueToModify.length -
                                                positionSuffix.length
                                            )),
                                            1
                                        )
                                    else if (target.includes(valueToModify))
                                        target.splice(
                                            target.indexOf(valueToModify), 1)
                            } else if (key === prependIndicatorKey)
                                target = [].concat(source[key]).concat(target)
                            else
                                target = target.concat(source[key])
                        else if (key === removeIndicatorKey)
                            for (const valueToModify:any of [].concat(
                                source[key]
                            ))
                                if (target.hasOwnProperty(valueToModify))
                                    delete target[valueToModify]
                        delete source[key]
                        if (parentSource && parentKey)
                            delete parentSource[parentKey]
                    } else if (target !== null && target.hasOwnProperty(key))
                        // IgnoreTypeCheck
                        target[key] = Tools.modifyObject(
                            // IgnoreTypeCheck
                            target[key],
                            source[key],
                            removeIndicatorKey,
                            prependIndicatorKey,
                            appendIndicatorKey,
                            positionPrefix,
                            positionSuffix,
                            source,
                            key
                        )
        return target
    }
    /**
     * Interprets a date object from given artefact.
     * @param value - To interpret.
     * @param interpretAsUTC - Identifies if given date should be interpret as
     * utc.
     * @returns Interpreted date object or "null" if given value couldn't be
     * interpret.
     */
    static normalizeDateTime(
        value:?string|?number|?Date = null, interpretAsUTC:boolean = true
    ):Date|null {
        if (value === null)
            return new Date()
        if (typeof value === 'string')
            /*
                We make a simple precheck to determine if it could be a date
                like representation. Idea: There should be at least some
                numbers and separators.
            */
            if (/^.*(?:(?:[0-9]{1,4}[^0-9]){2}|[0-9]{1,4}[^0-9.]).*$/.test(
                value
            )) {
                value = Tools.stringInterpretDateTime(value, interpretAsUTC)
                if (value === null)
                    return value
            } else {
                const floatRepresentation:number = parseFloat(value)
                if (`${floatRepresentation}` === value)
                    value = floatRepresentation
            }
        if (typeof value === 'number')
            return new Date(value * 1000)
        // IgnoreTypeCheck
        const result:Date = new Date(value)
        if (isNaN(result.getDate()))
            return null
        return result
    }
    /**
     * Removes given key from given object recursively.
     * @param object - Object to process.
     * @param keys - List of keys to remove.
     * @returns Processed given object.
     */
    static removeKeys(object:any, keys:Array<string>|string = '#'):any {
        const resolvedKeys:Array<string> = [].concat(keys)
        if (Array.isArray(object)) {
            let index:number = 0
            for (const subObject:any of object.slice()) {
                let skip:boolean = false
                if (typeof subObject === 'string') {
                    for (const key:string of resolvedKeys)
                        if (subObject.startsWith(`${key}:`)) {
                            object.splice(index, 1)
                            skip = true
                            break
                        }
                    if (skip)
                        continue
                }
                object[index] = Tools.removeKeys(subObject, resolvedKeys)
                index += 1
            }
        } else if (Tools.determineType(object) === 'set')
            for (const subObject:any of new Set(object)) {
                let skip:boolean = false
                if (typeof subObject === 'string') {
                    for (const key:string of resolvedKeys)
                        if (subObject.startsWith(`${key}:`)) {
                            object.delete(subObject)
                            skip = true
                            break
                        }
                    if (skip)
                        continue
                }
                Tools.removeKeys(subObject, resolvedKeys)
            }
        else if (Tools.determineType(object) === 'map')
            for (const [key:any, subObject:any] of new Map(object)) {
                let skip:boolean = false
                if (typeof key === 'string') {
                    for (const resolvedKey:string of resolvedKeys) {
                        const escapedKey:string =
                            Tools.stringEscapeRegularExpressions(resolvedKey)
                        if (new RegExp(`^${escapedKey}[0-9]*$`).test(key)) {
                            object.delete(key)
                            skip = true
                            break
                        }
                    }
                    if (skip)
                        continue
                }
                object.set(key, Tools.removeKeys(subObject, resolvedKeys))
            }
        else if (object !== null && typeof object === 'object')
            for (const key:string in Object.assign({}, object))
                if (object.hasOwnProperty(key)) {
                    let skip:boolean = false
                    for (const resolvedKey:string of resolvedKeys) {
                        const escapedKey:string =
                            Tools.stringEscapeRegularExpressions(resolvedKey)
                        if (new RegExp(`^${escapedKey}[0-9]*$`).test(key)) {
                            delete object[key]
                            skip = true
                            break
                        }
                    }
                    if (skip)
                        continue
                    object[key] = Tools.removeKeys(object[key], resolvedKeys)
                }
        return object
    }
    /**
     * Represents given object as formatted string.
     * @param object - Object to represent.
     * @param indention - String (usually whitespaces) to use as indention.
     * @param initialIndention - String (usually whitespaces) to use as
     * additional indention for the first object traversing level.
     * @param numberOfLevels - Specifies number of levels to traverse given
     * data structure.
     * @param maximumNumberOfLevelsReachedIdentifier - Replacement for objects
     * which are out of specified bounds to traverse.
     * @returns Representation string.
     */
    static representObject(
        object:any,
        indention:string = '    ',
        initialIndention:string = '',
        numberOfLevels:number = 8,
        maximumNumberOfLevelsReachedIdentifier:any =
        '__maximum_number_of_levels_reached__'
    ):string {
        if (numberOfLevels === 0)
            return maximumNumberOfLevelsReachedIdentifier
        if (object === null)
            return 'null'
        if (object === undefined)
            return 'undefined'
        if (typeof object === 'string')
            return `"${object.replace(/\n/g, `\n${initialIndention}`)}"`
        if (Tools.isNumeric(object) || typeof object === 'boolean')
            return `${object}`
        if (Array.isArray(object)) {
            let result:string = '['
            let firstSeen:boolean = false
            for (const item:any of object) {
                if (firstSeen)
                    result += ','
                result += `\n${initialIndention}${indention}` +
                    Tools.representObject(
                        item, indention, `${initialIndention}${indention}`,
                        numberOfLevels - 1,
                        maximumNumberOfLevelsReachedIdentifier)
                firstSeen = true
            }
            if (firstSeen)
                result += `\n${initialIndention}`
            result += ']'
            return result
        }
        if (Tools.determineType(object) === 'map') {
            let result:string = ''
            let firstSeen:boolean = false
            for (const [key:any, item:any] of object) {
                if (firstSeen)
                    result += `,\n${initialIndention}${indention}`
                result += Tools.representObject(
                    key, indention, `${initialIndention}${indention}`,
                    numberOfLevels - 1, maximumNumberOfLevelsReachedIdentifier
                ) + ' -> ' +
                    Tools.representObject(
                        item, indention, `${initialIndention}${indention}`,
                        numberOfLevels - 1,
                        maximumNumberOfLevelsReachedIdentifier)
                firstSeen = true
            }
            if (!firstSeen)
                result = 'EmptyMap'
            return result
        }
        if (Tools.determineType(object) === 'set') {
            let result:string = '{'
            let firstSeen:boolean = false
            for (const item:any of object) {
                if (firstSeen)
                    result += ','
                result += `\n${initialIndention}${indention}` +
                    Tools.representObject(
                        item, indention, `${initialIndention}${indention}`,
                        numberOfLevels - 1,
                        maximumNumberOfLevelsReachedIdentifier)
                firstSeen = true
            }
            if (firstSeen)
                result += `\n${initialIndention}}`
            else
                result = 'EmptySet'
            return result
        }
        let result:string = '{'
        const keys:Array<string> = Object.getOwnPropertyNames(object).sort()
        let firstSeen:boolean = false
        for (const key:string of keys) {
            if (firstSeen)
                result += ','
            result += `\n${initialIndention}${indention}${key}: ` +
                Tools.representObject(
                    object[key],
                    indention,
                    `${initialIndention}${indention}`,
                    numberOfLevels - 1,
                    maximumNumberOfLevelsReachedIdentifier
                )
            firstSeen = true
        }
        if (firstSeen)
            result += `\n${initialIndention}`
        result += '}'
        return result
    }
    /**
     * Sort given objects keys.
     * @param object - Object which keys should be sorted.
     * @returns Sorted list of given keys.
     */
    static sort(object:any):Array<any> {
        const keys:Array<any> = []
        if (Array.isArray(object))
            for (let index:number = 0; index < object.length; index++)
                keys.push(index)
        else if (typeof object === 'object')
            if (Tools.determineType(object) === 'map')
                for (const keyValuePair:Array<any> of object)
                    keys.push(keyValuePair[0])
            else if (object !== null)
                for (const key:string in object)
                    if (object.hasOwnProperty(key))
                        keys.push(key)
        return keys.sort()
    }
    /**
     * Removes a proxy from given data structure recursively.
     * @param object - Object to proxy.
     * @param seenObjects - Tracks all already processed objects to avoid
     * endless loops (usually only needed for internal purpose).
     * @returns Returns given object unwrapped from a dynamic proxy.
     */
    static unwrapProxy(object:any, seenObjects:Set<any> = new Set()):any {
        if (object !== null && typeof object === 'object') {
            if (seenObjects.has(object))
                return object
            try {
                if (object.__revoke__) {
                    object = object.__target__
                    object.__revoke__()
                }
            } catch (error) {
                return object
            } finally {
                seenObjects.add(object)
            }
            if (Array.isArray(object)) {
                let index:number = 0
                for (const value:any of object) {
                    object[index] = Tools.unwrapProxy(value, seenObjects)
                    index += 1
                }
            } else if (Tools.determineType(object) === 'map')
                for (const [key:any, value:any] of object)
                    object.set(key, Tools.unwrapProxy(value, seenObjects))
            else if (Tools.determineType(object) === 'set') {
                const cache:Array<any> = []
                for (const value:any of object) {
                    object.delete(value)
                    cache.push(Tools.unwrapProxy(value, seenObjects))
                }
                for (const value:any of cache)
                    object.add(value)
            } else
                for (const key:string in object)
                    if (object.hasOwnProperty(key))
                        object[key] = Tools.unwrapProxy(
                            object[key], seenObjects)
        }
        return object
    }
    // / endregion
    // / region array
    /**
     * Summarizes given property of given item list.
     * @param data - Array of objects with given property name.
     * @param propertyName - Property name to summarize.
     * @param defaultValue - Value to return if property values doesn't match.
     * @returns Summarized array.
     */
    static arrayAggregatePropertyIfEqual(
        data:Array<Object>, propertyName:string, defaultValue:any = ''
    ):any {
        let result:any = defaultValue
        if (data && data.length && data[0].hasOwnProperty(propertyName)) {
            result = data[0][propertyName]
            for (const item of Tools.arrayMake(data))
                if (item[propertyName] !== result)
                    return defaultValue
        }
        return result
    }
    /**
     * Deletes every item witch has only empty attributes for given property
     * names. If given property names are empty each attribute will be
     * considered. The empty string, "null" and "undefined" will be interpreted
     * as empty.
     * @param data - Data to filter.
     * @param propertyNames - Properties to consider.
     * @returns Given data without empty items.
     */
    static arrayDeleteEmptyItems(
        data:?Array<Object>, propertyNames:Array<string> = []
    ):?Array<Object> {
        if (!data)
            return data
        const result:Array<any> = []
        for (const item:any of Tools.arrayMake(data)) {
            let empty:boolean = true
            for (const propertyName:string in item)
                if (item.hasOwnProperty(propertyName))
                    if (
                        !['', null, undefined].includes(item[propertyName]) &&
                        (!propertyNames.length || Tools.arrayMake(
                            propertyNames
                        ).includes(propertyName))
                    ) {
                        empty = false
                        break
                    }
            if (!empty)
                result.push(item)
        }
        return result
    }
    /**
     * Extracts all properties from all items wich occur in given property
     * names.
     * @param data - Data where each item should be sliced.
     * @param propertyNames - Property names to extract.
     * @returns Data with sliced items.
     */
    static arrayExtract(
        data:Array<Object>, propertyNames:Array<string>
    ):Array<Object> {
        const result:Array<Object> = []
        for (const item:Object of Tools.arrayMake(data)) {
            const newItem:Object = {}
            for (const propertyName:string of Tools.arrayMake(propertyNames))
                if (item.hasOwnProperty(propertyName))
                    newItem[propertyName] = item[propertyName]
            result.push(newItem)
        }
        return result
    }
    /**
     * Extracts all values which matches given regular expression.
     * @param data - Data to filter.
     * @param regularExpression - Pattern to match for.
     * @returns Filtered data.
     */
    static arrayExtractIfMatches(
        data:Array<string>, regularExpression:string|RegExp
    ):Array<string> {
        if (!regularExpression)
            return Tools.arrayMake(data)
        const result:Array<string> = []
        for (const value:string of Tools.arrayMake(data))
            if (((typeof regularExpression === 'string') ? new RegExp(
                regularExpression
            ) : regularExpression).test(value))
                result.push(value)
        return result
    }
    /**
     * Filters given data if given property is set or not.
     * @param data - Data to filter.
     * @param propertyName - Property name to check for existence.
     * @returns Given data without the items which doesn't have specified
     * property.
     */
    static arrayExtractIfPropertyExists(
        data:?Array<Object>, propertyName:string
    ):?Array<Object> {
        if (data && propertyName) {
            const result:Array<Object> = []
            for (const item:Object of Tools.arrayMake(data)) {
                let exists:boolean = false
                for (const key:string in item)
                    if (key === propertyName && item.hasOwnProperty(key) && ![
                        undefined, null
                    ].includes(item[key])) {
                        exists = true
                        break
                    }
                if (exists)
                    result.push(item)
            }
            return result
        }
        return data
    }
    /**
     * Extract given data where specified property value matches given
     * patterns.
     * @param data - Data to filter.
     * @param propertyPattern - Mapping of property names to pattern.
     * @returns Filtered data.
     */
    static arrayExtractIfPropertyMatches(
        data:?Array<Object>, propertyPattern:{[key:string]:string|RegExp}
    ):?Array<Object> {
        if (data && propertyPattern) {
            const result:Array<Object> = []
            for (const item:Object of Tools.arrayMake(data)) {
                let matches:boolean = true
                for (const propertyName:string in propertyPattern)
                    if (!(propertyPattern[propertyName] && (
                        (typeof propertyPattern[propertyName] === 'string') ?
                            new RegExp(propertyPattern[propertyName]) :
                            propertyPattern[propertyName]
                    ).test(item[propertyName]))) {
                        matches = false
                        break
                    }
                if (matches)
                    result.push(item)
            }
            return result
        }
        return data
    }
    /**
     * Determines all objects which exists in "first" and in "second".
     * Object key which will be compared are given by "keys". If an empty array
     * is given each key will be compared. If an object is given corresponding
     * initial data key will be mapped to referenced new data key.
     * @param first - Referenced data to check for.
     * @param second - Data to check for existence.
     * @param keys - Keys to define equality.
     * @param strict - The strict parameter indicates whether "null" and
     * "undefined" should be interpreted as equal (takes only effect if given
     * keys aren't empty).
     * @returns Data which does exit in given initial data.
     */
    static arrayIntersect(
        first:Array<any>,
        second:Array<any>,
        // IgnoreTypeCheck
        keys:Object|Array<string> = [],
        strict:boolean = true
    ):Array<any> {
        const containingData:Array<any> = []
        second = Tools.arrayMake(second)
        const intersectItem:Function = (
            firstItem:any, secondItem:any, firstKey:string|number,
            secondKey:string|number, keysAreAnArray:boolean,
            iterateGivenKeys:boolean
        ):?false => {
            if (iterateGivenKeys) {
                if (keysAreAnArray)
                    firstKey = secondKey
            } else
                secondKey = firstKey
            if (
                secondItem[secondKey] !== firstItem[firstKey] &&
                (strict || !([null, undefined].includes(
                    secondItem[secondKey]
                ) && [null, undefined].includes(firstItem[firstKey])))
            )
                return false
        }
        for (const firstItem:any of Tools.arrayMake(first))
            if (Tools.isPlainObject(firstItem))
                for (const secondItem:any of second) {
                    let exists:boolean = true
                    let iterateGivenKeys:boolean
                    const keysAreAnArray:boolean = Array.isArray(keys)
                    if (Tools.isPlainObject(
                        keys
                    ) || keysAreAnArray && keys.length)
                        iterateGivenKeys = true
                    else {
                        iterateGivenKeys = false
                        keys = firstItem
                    }
                    if (Array.isArray(keys)) {
                        let index:number = 0
                        for (const key:string of keys) {
                            if (intersectItem(
                                firstItem, secondItem, index, key,
                                keysAreAnArray, iterateGivenKeys
                            ) === false) {
                                exists = false
                                break
                            }
                            index += 1
                        }
                    } else
                        for (const key:string in keys)
                            if (keys.hasOwnProperty(key))
                                if (intersectItem(
                                    firstItem, secondItem, key, keys[key],
                                    keysAreAnArray, iterateGivenKeys
                                ) === false) {
                                    exists = false
                                    break
                                }
                    if (exists) {
                        containingData.push(firstItem)
                        break
                    }
                }
            else if (second.includes(firstItem))
                containingData.push(firstItem)
        return containingData
    }
    /**
     * Creates a list of items within given range.
     * @param range - Array of lower and upper bounds. If only one value is
     * given lower bound will be assumed to be zero. Both integers have to be
     * positive and will be contained in the resulting array.
     * @param step - Space between two consecutive values.
     * @returns Produced array of integers.
     */
    static arrayMakeRange(range:Array<number>, step:number = 1):Array<number> {
        let index:number
        let higherBound:number
        if (range.length === 1) {
            index = 0
            higherBound = parseInt(range[0], 10)
        } else if (range.length === 2) {
            index = parseInt(range[0], 10)
            higherBound = parseInt(range[1], 10)
        } else
            return range
        const result = [index]
        while (index <= higherBound - step) {
            index += step
            result.push(index)
        }
        return result
    }
    /**
     * Merge the contents of two arrays together into the first array.
     * @param target - Target array.
     * @param source - Source array.
     * @returns Target array with merged given source one.
     */
    static arrayMerge(target:Array<any>, source:Array<any>):Array<any> {
        if (!Array.isArray(source))
            source = Array.prototype.slice.call(source)
        for (const value:any of source)
            target.push(value)
        return target
    }
    /**
     * Converts given object into an array.
     * @param object - Target to convert.
     * @returns Generated array.
     */
    static arrayMake(object:any):Array<any> {
        const result:Array<any> = []
        if (![null, undefined].includes(result))
            if (Tools.isArrayLike(Object(object)))
                Tools.arrayMerge(
                    result, typeof object === 'string' ? [object] : object)
            else
                result.push(object)
        return result
    }
    /**
     * Makes all values in given iterable unique by removing duplicates (The
     * first occurrences will be left).
     * @param data - Array like object.
     * @returns Sliced version of given object.
     */
    static arrayUnique(data:Array<any>):Array<any> {
        const result:Array<any> = []
        for (const value:any of Tools.arrayMake(data))
            if (!result.includes(value))
                result.push(value)
        return result
    }
    /**
     * Generates all permutations of given iterable.
     * @param data - Array like object.
     * @returns Array of permuted arrays.
     */
    static arrayPermutate(data:Array<any>):Array<Array<any>> {
        const result:Array<Array<any>> = []

        const permute:Function = (
            currentData:Array<any>, dataToMixin:Array<any> = []
        ):void => {
            if (currentData.length === 0)
                result.push(dataToMixin)
            else
                for (
                    let index:number = 0; index < currentData.length; index++
                ) {
                    const copy = currentData.slice()
                    permute(copy, dataToMixin.concat(copy.splice(index, 1)))
                }
        }

        permute(data)
        return result
    }
    /**
     * Generates all lengths permutations of given iterable.
     * @param data - Array like object.
     * @param minimalSubsetLength - Defines how long the minimal subset length
     * should be.
     * @returns Array of permuted arrays.
     */
    static arrayPermutateLength(
        data:Array<any>, minimalSubsetLength:number = 1
    ):Array<Array<any>> {
        const result:Array<Array<any>> = []
        if (data.length === 0)
            return result
        const generate:Function = (
            index:number, source:Array<any>, rest:Array<any>
        ):void => {
            if (index === 0) {
                if (rest.length > 0)
                    result[result.length] = rest
                return
            }
            for (
                let sourceIndex:number = 0;
                sourceIndex < source.length;
                sourceIndex++
            )
                generate(
                    index - 1,
                    source.slice(sourceIndex + 1),
                    rest.concat([source[sourceIndex]])
                )
        }
        for (
            let index:number = minimalSubsetLength;
            index < data.length;
            index++
        )
            generate(index, data, [])
        result.push(data)
        return result
    }
    /**
     * Sums up given property of given item list.
     * @param data - The objects with specified property to sum up.
     * @param propertyName - Property name to sum up its value.
     * @returns The aggregated value.
     */
    static arraySumUpProperty(
        data:?Array<Object>, propertyName:string
    ):number {
        let result:number = 0
        if (Array.isArray(data) && data.length)
            for (const item:Object of data)
                if (item.hasOwnProperty(propertyName))
                    result += parseFloat(item[propertyName] || 0)
        return result
    }
    /**
     * Adds an item to another item as array connection (many to one).
     * @param item - Item where the item should be appended to.
     * @param target - Target to add to given item.
     * @param name - Name of the target connection.
     * @param checkIfExists - Indicates if duplicates are allowed in resulting
     * list (will result in linear runtime instead of constant one).
     * @returns Item with the appended target.
     */
    static arrayAppendAdd(
        item:Object, target:any, name:string, checkIfExists:boolean = true
    ):Object {
        if (item.hasOwnProperty(name)) {
            if (!(checkIfExists && item[name].includes(target)))
                item[name].push(target)
        } else
            item[name] = [target]
        return item
    }
    /**
     * Removes given target on given list.
     * @param list - Array to splice.
     * @param target - Target to remove from given list.
     * @param strict - Indicates whether to fire an exception if given target
     * doesn't exists given list.
     * @returns Item with the appended target.
     */
    static arrayRemove(
        list:?Array<any>, target:any, strict:boolean = false
    ):?Array<any> {
        if (Array.isArray(list)) {
            const index:number = list.indexOf(target)
            if (index === -1) {
                if (strict)
                    throw new Error(
                        `Given target doesn't exists in given list.`)
            } else
                /* eslint-disable max-statements-per-line */
                list.splice(index, 1)
                /* eslint-enable max-statements-per-line */
        } else if (strict)
            throw new Error(`Given target isn't an array.`)
        return list
    }
    /**
     * Sorts given object of dependencies in a topological order.
     * @param items - Items to sort.
     * @returns Sorted array of given items respecting their dependencies.
     */
    static arraySortTopological(
        items:{[key:string]:Array<string>}
    ):Array<string> {
        const edges:Array<Array<string>> = []
        for (const name:string in items)
            if (items.hasOwnProperty(name)) {
                if (!Array.isArray(items[name]))
                    items[name] = [items[name]]
                if (items[name].length > 0)
                    for (const dependencyName:string of Tools.arrayMake(
                        items[name]
                    ))
                        edges.push([name, dependencyName])
                else
                    edges.push([name])
            }
        const nodes:Array<?string> = []
        // Accumulate unique nodes into a large list.
        for (const edge:Array<string> of edges)
            for (const node:string of edge)
                if (!nodes.includes(node))
                    nodes.push(node)
        const sorted:Array<string> = []
        // Define a visitor function that recursively traverses dependencies.
        const visit:Function = (
            node:string, predecessors:Array<string>
        ):void => {
            // Check if a node is dependent of itself.
            if (predecessors.length !== 0 && predecessors.includes(node))
                throw new Error(
                    `Cyclic dependency found. "${node}" is dependent of ` +
                    'itself.\n' +
                    `Dependency chain: "${predecessors.join('" -> "')}" => "` +
                    `${node}".`)
            const index = nodes.indexOf(node)
            // If the node still exists, traverse its dependencies.
            if (index !== -1) {
                let copy:?Array<string>
                // Mark the node to exclude it from future iterations.
                nodes[index] = null
                /*
                    Loop through all edges and follow dependencies of the
                    current node
                */
                for (const edge:Array<string> of edges)
                    if (edge[0] === node) {
                        /*
                            Lazily create a copy of predecessors with the
                            current node concatenated onto it.
                        */
                        copy = copy || predecessors.concat([node])
                        // Recurse to node dependencies.
                        visit(edge[1], copy)
                    }
                sorted.push(node)
            }
        }
        for (let index = 0; index < nodes.length; index++) {
            const node:?string = nodes[index]
            // Ignore nodes that have been excluded.
            if (node) {
                // Mark the node to exclude it from future iterations.
                nodes[index] = null
                /*
                    Loop through all edges and follow dependencies of the
                    current node.
                */
                for (const edge:Array<string> of edges)
                    if (edge[0] === node)
                        // Recurse to node dependencies.
                        visit(edge[1], [node])
                sorted.push(node)
            }
        }
        return sorted
    }
    // / endregion
    // / region string
    // // region url handling
    /**
     * Translates given string into the regular expression validated
     * representation.
     * @param value - String to convert.
     * @param excludeSymbols - Symbols not to escape.
     * @returns Converted string.
     */
    static stringEscapeRegularExpressions(
        value:string, excludeSymbols:Array<string> = []
    ):string {
        // NOTE: This is only for performance improvements.
        if (value.length === 1 && !Tools.specialRegexSequences.includes(value))
            return value
        // The escape sequence must also be escaped; but at first.
        if (!excludeSymbols.includes('\\'))
            value.replace(/\\/g, '\\\\')
        for (const replace:string of Tools.specialRegexSequences)
            if (!excludeSymbols.includes(replace))
                value = value.replace(
                    new RegExp(`\\${replace}`, 'g'), `\\${replace}`)
        return value
    }
    /**
     * Translates given name into a valid javaScript one.
     * @param name - Name to convert.
     * @param allowedSymbols - String of symbols which should be allowed within
     * a variable name (not the first character).
     * @returns Converted name is returned.
     */
    static stringConvertToValidVariableName(
        name:string, allowedSymbols:string = '0-9a-zA-Z_$'
    ):string {
        return name.toString().replace(/^[^a-zA-Z_$]+/, '').replace(
            new RegExp(`[^${allowedSymbols}]+([a-zA-Z0-9])`, 'g'), (
                fullMatch:string, firstLetter:string
            ):string => firstLetter.toUpperCase())
    }
    /**
     * This method is intended for encoding *key* or *value* parts of query
     * component. We need a custom method because "encodeURIComponent()" is too
     * aggressive and encodes stuff that doesn't have to be encoded per
     * "http://tools.ietf.org/html/rfc3986:".
     * @param url - URL to encode.
     * @param encodeSpaces - Indicates whether given url should encode
     * whitespaces as "+" or "%20".
     * @returns Encoded given url.
     */
    static stringEncodeURIComponent(url:string, encodeSpaces:boolean):string {
        return encodeURIComponent(url).replace(/%40/gi, '@').replace(
            /%3A/gi, ':'
        ).replace(/%24/g, '$').replace(/%2C/gi, ',').replace(
            /%20/g, (encodeSpaces) ? '%20' : '+')
    }
    /**
     * Appends a path selector to the given path if there isn't one yet.
     * @param path - The path for appending a selector.
     * @param pathSeparator - The selector for appending to path.
     * @returns The appended path.
     */
    static stringAddSeparatorToPath(
        path:string, pathSeparator:string = '/'
    ):string {
        path = path.trim()
        if (path.substr(-1) !== pathSeparator && path.length)
            return path + pathSeparator
        return path
    }
    /**
     * Checks if given path has given path prefix.
     * @param prefix - Path prefix to search for.
     * @param path - Path to search in.
     * @param separator - Delimiter to use in path (default is the posix
     * conform slash).
     * @returns Value "true" if given prefix occur and "false" otherwise.
     */
    static stringHasPathPrefix(
        prefix:?string = '/admin',
        path:string = (
            'location' in $.global && $.global.location.pathname || ''),
        separator:string = '/'
    ):boolean {
        if (typeof prefix === 'string') {
            if (!prefix.endsWith(separator))
                prefix += separator
            return path === prefix.substring(
                0, prefix.length - separator.length
            ) || path.startsWith(prefix)
        }
        return false
    }
    /**
     * Extracts domain name from given url. If no explicit domain name given
     * current domain name will be assumed. If no parameter given current
     * domain name will be determined.
     * @param url - The url to extract domain from.
     * @param fallback - The fallback host name if no one exits in given url
     * (default is current hostname).
     * @returns Extracted domain.
     */
    static stringGetDomainName(
        url:string = 'location' in $.global && $.global.location.href || '',
        fallback:any = (
            'location' in $.global && $.global.location.hostname || ''
        )
    ):any {
        const result:?Array<string> =
            /^([a-z]*:?\/\/)?([^/]+?)(?::[0-9]+)?(?:\/.*|$)/i.exec(url)
        if (result && result.length > 2 && result[1] && result[2])
            return result[2]
        return fallback
    }
    /**
     * Extracts port number from given url. If no explicit port number given
     * and no fallback is defined current port number will be assumed for local
     * links. For external links 80 will be assumed for http protocol or 443
     * for https.
     * @param url - The url to extract port from.
     * @param fallback - Fallback port number if no explicit one was found.
     * Default is derived from current protocol name.
     * @param parameter - Additional parameter for checking if given url is an
     * internal url. Given url and this parameter will be forwarded to the
     * "stringIsInternalURL()" method.
     * @returns Extracted port number.
     */
    static stringGetPortNumber(
        url:string = 'location' in $.global && $.global.location.href || '',
        fallback:any = null, parameter:Array<string> = []
    ):number {
        const result:?Array<string> =
            /^(?:[a-z]*:?\/\/[^/]+?)?(?:[^/]+?):([0-9]+)/i.exec(url)
        if (result && result.length > 1)
            return parseInt(result[1], 10)
        if (fallback !== null)
            return fallback
        if (Tools.stringIsInternalURL(
            url, ...parameter
        ) && 'location' in $.global && $.global.location.port &&
            parseInt($.global.location.port, 10)
        )
            return parseInt($.global.location.port, 10)
        return (Tools.stringGetProtocolName(url) === 'https') ? 443 : 80
    }
    /**
     * Extracts protocol name from given url. If no explicit url is given,
     * current protocol will be assumed. If no parameter given current protocol
     * number will be determined.
     * @param url - The url to extract protocol from.
     * @param fallback - Fallback port to use if no protocol exists in given
     * url (default is current protocol).
     * @returns Extracted protocol.
     */
    static stringGetProtocolName(
        url:string = 'location' in $.global && $.global.location.href || '',
        fallback:any = 'location' in $.global &&
            $.global.location.protocol.substring(
                0, $.global.location.protocol.length - 1) || ''
    ):any {
        const result:?Array<string> = /^([a-z]+):\/\//i.exec(url)
        if (result && result.length > 1 && result[1])
            return result[1]
        return fallback
    }
    /**
     * Read a page's GET URL variables and return them as an associative array
     * and preserves ordering.
     * @param keyToGet - If key given the corresponding value is returned and
     * full object otherwise.
     * @param givenInput - An alternative input to the url search parameter. If
     * "#" is given the complete current hash tag will be interpreted as url
     * and search parameter will be extracted from there. If "&" is given
     * classical search parameter and hash parameter will be taken in account.
     * If a search string is given this will be analyzed. The default is to
     * take given search part into account.
     * @param subDelimiter - Defines which sequence indicates the start of
     * parameter in a hash part of the url.
     * @param hashedPathIndicator - If defined and given hash starts with this
     * indicator given hash will be interpreted as path containing search and
     * hash parts.
     * @param givenSearch - Search part to take into account defaults to
     * current url search part.
     * @param givenHash - Hash part to take into account defaults to current
     * url hash part.
     * @returns Returns the current get array or requested value. If requested
     * key doesn't exist "undefined" is returned.
     */
    static stringGetURLVariable(
        keyToGet:?string,
        givenInput:?string,
        subDelimiter:string = '$',
        hashedPathIndicator:string = '!',
        givenSearch:?string,
        givenHash:?string = (
            'location' in $.global && $.global.location.hash || ''
        )
    ):Array<string>|string|null {
        // region set search and hash
        let hash:string = (givenHash) ? givenHash : '#'
        let search:string = ''
        if (givenSearch)
            search = givenSearch
        else if (hashedPathIndicator && hash.startsWith(hashedPathIndicator)) {
            const subHashStartIndex:number = hash.indexOf('#')
            let pathAndSearch:string
            if (subHashStartIndex === -1) {
                pathAndSearch = hash.substring(hashedPathIndicator.length)
                hash = ''
            } else {
                pathAndSearch = hash.substring(
                    hashedPathIndicator.length, subHashStartIndex)
                hash = hash.substring(subHashStartIndex)
            }
            const subSearchStartIndex:number = pathAndSearch.indexOf('?')
            if (subSearchStartIndex !== -1)
                search = pathAndSearch.substring(subSearchStartIndex)
        } else if ('location' in $.global)
            search = $.global.location.search || ''
        let input:string = (givenInput) ? givenInput : search
        // endregion
        // region determine data from search and hash if specified
        const both:boolean = input === '&'
        if (both || input === '#') {
            let decodedHash:string = ''
            try {
                decodedHash = decodeURIComponent(hash)
            } catch (error) {}
            const subDelimiterIndex:number = decodedHash.indexOf(subDelimiter)
            if (subDelimiterIndex === -1)
                input = ''
            else {
                input = decodedHash.substring(subDelimiterIndex)
                if (input.startsWith(subDelimiter))
                    input = input.substring(subDelimiter.length)
            }
        } else if (input.startsWith('?'))
            input = input.substring('?'.length)
        let data:Array<string> = (input) ? input.split('&') : []
        search = search.substring('?'.length)
        if (both && search)
            data = data.concat(search.split('&'))
        // endregion
        // region construct data structure
        const variables:Array<string> = []
        for (let value:string of data) {
            const keyValuePair:Array<string> = value.split('=')
            let key:string
            try {
                key = decodeURIComponent(keyValuePair[0])
            } catch (error) {
                key = ''
            }
            try {
                value = decodeURIComponent(keyValuePair[1])
            } catch (error) {
                value = ''
            }
            variables.push(key)
            // IgnoreTypeCheck
            variables[key] = value
        }
        // endregion
        if (keyToGet) {
            if (variables.hasOwnProperty(keyToGet))
                // IgnoreTypeCheck
                return variables[keyToGet]
            return null
        }
        return variables
    }
    /**
     * Checks if given url points to another domain than second given url. If
     * no second given url provided current url will be assumed.
     * @param firstURL - URL to check against second url.
     * @param secondURL - URL to check against first url.
     * @returns Returns "true" if given first url has same domain as given
     * second (or current).
     */
    static stringIsInternalURL(
        firstURL:string,
        secondURL:string = (
            'location' in $.global && $.global.location.href || ''
        )
    ):boolean {
        const explicitDomainName:string = Tools.stringGetDomainName(
            firstURL, false)
        const explicitProtocolName:string = Tools.stringGetProtocolName(
            firstURL, false)
        const explicitPortNumber = Tools.stringGetPortNumber(firstURL, false)
        return (
            !explicitDomainName ||
            explicitDomainName === Tools.stringGetDomainName(secondURL)
        ) && (
            !explicitProtocolName ||
            explicitProtocolName === Tools.stringGetProtocolName(secondURL)
        ) && (
            !explicitPortNumber ||
            explicitPortNumber === Tools.stringGetPortNumber(secondURL))
    }
    /**
     * Normalized given website url.
     * @param url - Uniform resource locator to normalize.
     * @returns Normalized result.
     */
    static stringNormalizeURL(url:?string):string {
        if (url) {
            url = url.replace(/^:?\/+/, '').replace(/\/+$/, '').trim()
            if (url.startsWith('http'))
                return url
            return `http://${url}`
        }
        return ''
    }
    /**
     * Represents given website url.
     * @param url - Uniform resource locator to represent.
     * @returns Represented result.
     */
    static stringRepresentURL(url:?string):string {
        if (typeof url === 'string')
            return url.replace(/^(https?)?:?\/+/, '').replace(
                /\/+$/, ''
            ).trim()
        return ''
    }
    // // endregion
    /* eslint-disable jsdoc/require-description-complete-sentence */
    /**
     * Converts a camel cased string to its delimited string version.
     * @param string - The string to format.
     * @param delimiter - Delimiter string
     * @param abbreviations - Collection of shortcut words to represent upper
     * cased.
     * @returns The formatted string.
     */
    static stringCamelCaseToDelimited(
        string:string,
        delimiter:string = '-',
        abbreviations:?Array<string> = null
    ):string {
    /* eslint-enable jsdoc/require-description-complete-sentence */
        if (!abbreviations)
            abbreviations = Tools.abbreviations
        const escapedDelimiter:string =
            Tools.stringGetRegularExpressionValidated(delimiter)
        if (abbreviations.length) {
            let abbreviationPattern:string = ''
            for (const abbreviation:string of abbreviations) {
                if (abbreviationPattern)
                    abbreviationPattern += '|'
                abbreviationPattern += abbreviation.toUpperCase()
            }
            string = string.replace(new RegExp(
                `(${abbreviationPattern})(${abbreviationPattern})`, 'g'
            ), `$1${delimiter}$2`)
        }
        string = string.replace(new RegExp(
            `([^${escapedDelimiter}])([A-Z][a-z]+)`, 'g'
        ), `$1${delimiter}$2`)
        return string.replace(
            new RegExp('([a-z0-9])([A-Z])', 'g'), `$1${delimiter}$2`
        ).toLowerCase()
    }
    /* eslint-disable jsdoc/require-description-complete-sentence */
    /**
     * Converts a string to its capitalize representation.
     * @param string - The string to format.
     * @returns The formatted string.
     */
    static stringCapitalize(string:string):string {
    /* eslint-enable jsdoc/require-description-complete-sentence */
        return string.charAt(0).toUpperCase() + string.substring(1)
    }
    /**
     * Compresses given style attribute value.
     * @param styleValue - Style value to compress.
     * @returns The compressed value.
     */
    static stringCompressStyleValue(styleValue:string):string {
        return styleValue.replace(/ *([:;]) */g, '$1').replace(
            / +/g, ' '
        ).replace(/^;+/, '').replace(/;+$/, '').trim()
    }
    /**
     * Decodes all html symbols in text nodes in given html string.
     * @param htmlString - HTML string to decode.
     * @returns Decoded html string.
     */
    static stringDecodeHTMLEntities(htmlString:string):?string {
        if ('document' in $.global) {
            const textareaDomNode = $.global.document.createElement('textarea')
            textareaDomNode.innerHTML = htmlString
            return textareaDomNode.value
        }
        return null
    }
    /**
     * Converts a delimited string to its camel case representation.
     * @param string - The string to format.
     * @param delimiter - Delimiter string to use.
     * @param abbreviations - Collection of shortcut words to represent upper
     * cased.
     * @param preserveWrongFormattedAbbreviations - If set to "True" wrong
     * formatted camel case abbreviations will be ignored.
     * @param removeMultipleDelimiter - Indicates whether a series of delimiter
     * should be consolidated.
     * @returns The formatted string.
     */
    static stringDelimitedToCamelCase(
        string:string,
        delimiter:string = '-',
        abbreviations:?Array<string> = null,
        preserveWrongFormattedAbbreviations:boolean = false,
        removeMultipleDelimiter:boolean = false
    ):string {
        let escapedDelimiter:string =
            Tools.stringGetRegularExpressionValidated(delimiter)
        if (!abbreviations)
            abbreviations = Tools.abbreviations
        let abbreviationPattern:string
        if (preserveWrongFormattedAbbreviations)
            abbreviationPattern = abbreviations.join('|')
        else {
            abbreviationPattern = ''
            for (const abbreviation:string of abbreviations) {
                if (abbreviationPattern)
                    abbreviationPattern += '|'
                abbreviationPattern +=
                    `${Tools.stringCapitalize(abbreviation)}|${abbreviation}`
            }
        }
        let stringStartsWithDelimiter:boolean = false
        if (string.startsWith(delimiter)) {
            string = string.substring(delimiter.length)
            stringStartsWithDelimiter = true
        }
        string = string.replace(new RegExp(
            `(${escapedDelimiter})(${abbreviationPattern})` +
            `(${escapedDelimiter}|$)`, 'g'
        ), (
            fullMatch:string, before:string, abbreviation:string, after:string
        ):string => before + abbreviation.toUpperCase() + after)
        if (removeMultipleDelimiter)
            escapedDelimiter = `(?:${escapedDelimiter})+`
        string = string.replace(new RegExp(
            `${escapedDelimiter}([a-zA-Z0-9])`, 'g'
        ), (fullMatch:string, firstLetter:string):string =>
            firstLetter.toUpperCase())
        if (stringStartsWithDelimiter)
            string = delimiter + string
        return string
    }
    /**
     * Finds the string match of given query in given target text by applying
     * given normalisation function to target and query.
     * @param target - Target to search in.
     * @param query - Search string to search for.
     * @param normalizer - Function to use as normalisation for queries and
     * search targets.
     */
    static stringFindNormalizedMatchRange(
        target:any,
        query:any,
        normalizer:Function = (value:any):string => `${value}`.toLowerCase()
    ):?Array<number> {
        query = normalizer(query)
        if (normalizer(target) && query)
            for (let index = 0; index < target.length; index += 1)
                if (normalizer(target.substring(index)).startsWith(query)) {
                    if (query.length === 1)
                        return [index, index + 1]
                    for (
                        let subIndex = target.length; subIndex > index;
                        subIndex -= 1
                    )
                        if (!normalizer(target.substring(
                            index, subIndex
                        )).startsWith(query))
                            return [index, subIndex + 1]
                }
        return null
    }
    /**
     * Performs a string formation. Replaces every placeholder "{i}" with the
     * i'th argument.
     * @param string - The string to format.
     * @param additionalArguments - Additional arguments are interpreted as
     * replacements for string formating.
     * @returns The formatted string.
     */
    static stringFormat(
        string:string, ...additionalArguments:Array<any>
    ):string {
        additionalArguments.unshift(string)
        let index:number = 0
        for (const value:string|number of additionalArguments) {
            string = string.replace(
                new RegExp(`\\{${index}\\}`, 'gm'), `${value}`)
            index += 1
        }
        return string
    }
    /**
     * Calculates the edit (levenstein) distance between two given strings.
     * @param first - First string to compare.
     * @param second - Second string to compare.
     * @returns The distance as number.
     */
    static stringGetEditDistance(first:string, second:string):number {
        /*
            Create empty edit distance matrix for all possible modifications of
            substrings of "first" to substrings of "second".
        */
        const distanceMatrix:Array<Array<number>> =
            Array(second.length + 1).fill(null).map(():Array<number> =>
                Array(first.length + 1).fill(null)
            )
        /*
            Fill the first row of the matrix.
            If this is first row then we're transforming empty string to
            "first".
            In this case the number of transformations equals to size of
            "first" substring.
        */
        for (let index:number = 0; index <= first.length; index++)
            distanceMatrix[0][index] = index
        /*
            Fill the first column of the matrix.
            If this is first column then we're transforming empty string to
            "second".
            In this case the number of transformations equals to size of
            "second" substring.
        */
        for (let index:number = 0; index <= second.length; index++)
            distanceMatrix[index][0] = index
        for (
            let firstIndex:number = 1;
            firstIndex <= second.length;
            firstIndex++
        )
            for (
                let secondIndex = 1;
                secondIndex <= first.length;
                secondIndex++
            ) {
                const indicator:number =
                    first[secondIndex - 1] === second[firstIndex - 1] ? 0 : 1
                distanceMatrix[firstIndex][secondIndex] = Math.min(
                    // deletion
                    distanceMatrix[firstIndex][secondIndex - 1] + 1,
                    // insertion
                    distanceMatrix[firstIndex - 1][secondIndex] + 1,
                    // substitution
                    distanceMatrix[firstIndex - 1][secondIndex - 1] + indicator
                )
            }

        return distanceMatrix[second.length][first.length]
    }
    /**
     * Validates the current string for using in a regular expression pattern.
     * Special regular expression chars will be escaped.
     * @param string - The string to format.
     * @returns The formatted string.
     */
    static stringGetRegularExpressionValidated(string:string):string {
        return string.replace(/([\\|.*$^+[\]()?\-{}])/g, '\\$1')
    }
    /**
     * Interprets given content string as date time.
     * @param value - Date time string to interpret.
     * @param interpretAsUTC - Identifies if given date should be interpret as
     * utc.
     * @returns Interpret date time object.
     */
    static stringInterpretDateTime(
        value:string, interpretAsUTC:boolean = true
    ):Date|null {
        // NOTE: All patterns can assume lower cased strings.
        // TODO handle am/pm
        if (!Tools._dateTimePatternCache.length) {
            // region pre-compile regular expressions
            // / region pattern
            const millisecondPattern:string =
                '(?<millisecond>(?:0{0,3}[0-9])|(?:0{0,2}[1-9]{2})|' +
                '(?:0?[1-9]{3})|(?:1[1-9]{3}))'
            const minuteAndSecondPattern:string =
                '(?:0?[0-9])|(?:[1-5][0-9])|(?:60)'
            const secondPattern:string = `(?<second>${minuteAndSecondPattern})`
            const minutePattern:string = `(?<minute>${minuteAndSecondPattern})`
            const hourPattern:string =
                '(?<hour>(?:0?[0-9])|(?:1[0-9])|(?:2[1-4]))'
            const dayPattern:string =
                '(?<day>(?:0?[1-9])|(?:[1-2][0-9])|(?:3[01]))'
            const monthPattern:string = '(?<month>(?:0?[1-9])|(?:1[0-2]))'
            const yearPattern:string = '(?<year>(?:0?[1-9])|(?:[1-9][0-9]+))'
            // / endregion
            const patternPresenceCache:{[key:string]:true} = {}
            for (const timeDelimiter:string of ['t', ' '])
                for (const timeComponentDelimiter:string of [
                    ':', '/', '-', ' '
                ])
                    for (const timeFormat:string of [
                        hourPattern +
                        `${timeComponentDelimiter}+` +
                        minutePattern,

                        hourPattern +
                        `${timeComponentDelimiter}+` +
                        minutePattern +
                        `${timeComponentDelimiter}+` +
                        secondPattern,

                        hourPattern +
                        `${timeComponentDelimiter}+` +
                        minutePattern +
                        `${timeComponentDelimiter}+` +
                        secondPattern +
                        `${timeComponentDelimiter}+` +
                        millisecondPattern,

                        hourPattern
                    ])
                        for (const dateTimeFormat:PlainObject of [
                            {
                                delimiter: ['/', '-', ' '],
                                pattern: [
                                    monthPattern +
                                    '${delimiter}' +
                                    dayPattern +
                                    '${delimiter}' +
                                    yearPattern,

                                    monthPattern +
                                    '${delimiter}' +
                                    dayPattern +
                                    ' +' +
                                    yearPattern,

                                    yearPattern +
                                    '${delimiter}' +
                                    monthPattern +
                                    '${delimiter}' +
                                    dayPattern,

                                    yearPattern +
                                    ' +' +
                                    monthPattern +
                                    '${delimiter}' +
                                    dayPattern,

                                    monthPattern +
                                    '${delimiter}' +
                                    dayPattern +
                                    '${delimiter}' +
                                    yearPattern +
                                    `${timeDelimiter}+` +
                                    timeFormat,

                                    monthPattern +
                                    '${delimiter}' +
                                    dayPattern +
                                    ' +' +
                                    yearPattern +
                                    `${timeDelimiter}+` +
                                    timeFormat,

                                    timeFormat +
                                    `${timeDelimiter}+` +
                                    monthPattern +
                                    '${delimiter}' +
                                    dayPattern +
                                    '${delimiter}' +
                                    yearPattern,

                                    timeFormat +
                                    `${timeDelimiter}+` +
                                    monthPattern +
                                    '${delimiter}' +
                                    dayPattern +
                                    ' +' +
                                    yearPattern,

                                    yearPattern +
                                    '${delimiter}' +
                                    monthPattern +
                                    '${delimiter}' +
                                    dayPattern +
                                    `${timeDelimiter}+` +
                                    timeFormat,

                                    yearPattern +
                                    ' +' +
                                    monthPattern +
                                    '${delimiter}' +
                                    dayPattern +
                                    `${timeDelimiter}+` +
                                    timeFormat,

                                    timeFormat +
                                    `${timeDelimiter}+` +
                                    yearPattern +
                                    '${delimiter}' +
                                    monthPattern +
                                    '${delimiter}' +
                                    dayPattern,

                                    timeFormat +
                                    `${timeDelimiter}+` +
                                    yearPattern +
                                    ' +' +
                                    monthPattern +
                                    '${delimiter}' +
                                    dayPattern
                                ]
                            },
                            {
                                delimiter: '\\.',
                                pattern: [
                                    dayPattern +
                                    '${delimiter}' +
                                    monthPattern +
                                    '${delimiter}' +
                                    yearPattern,

                                    dayPattern +
                                    '${delimiter}' +
                                    monthPattern +
                                    ' +' +
                                    yearPattern,

                                    yearPattern +
                                    '${delimiter}' +
                                    dayPattern +
                                    '${delimiter}' +
                                    monthPattern,

                                    yearPattern +
                                    ' +' +
                                    dayPattern +
                                    '${delimiter}' +
                                    monthPattern,

                                    dayPattern +
                                    '${delimiter}' +
                                    monthPattern +
                                    '${delimiter}' +
                                    yearPattern +
                                    `${timeDelimiter}+` +
                                    timeFormat,

                                    dayPattern +
                                    '${delimiter}' +
                                    monthPattern +
                                    ' +' +
                                    yearPattern +
                                    `${timeDelimiter}+` +
                                    timeFormat,

                                    timeFormat +
                                    `${timeDelimiter}+` +
                                    dayPattern +
                                    '${delimiter}' +
                                    monthPattern +
                                    '${delimiter}' +
                                    yearPattern,

                                    timeFormat +
                                    `${timeDelimiter}+` +
                                    dayPattern +
                                    '${delimiter}' +
                                    monthPattern +
                                    ' +' +
                                    yearPattern,

                                    yearPattern +
                                    '${delimiter}' +
                                    dayPattern +
                                    '${delimiter}' +
                                    monthPattern +
                                    `${timeDelimiter}+` +
                                    timeFormat,

                                    yearPattern +
                                    ' +' +
                                    dayPattern +
                                    '${delimiter}' +
                                    monthPattern +
                                    `${timeDelimiter}+` +
                                    timeFormat,

                                    timeFormat +
                                    `${timeDelimiter}+` +
                                    yearPattern +
                                    '${delimiter}' +
                                    dayPattern +
                                    '${delimiter}' +
                                    monthPattern,

                                    timeFormat +
                                    `${timeDelimiter}+` +
                                    yearPattern +
                                    ' +' +
                                    dayPattern +
                                    '${delimiter}' +
                                    monthPattern
                                ]
                            },
                            {pattern: timeFormat}
                        ])
                            for (
                                const delimiter:string of
                                [].concat(dateTimeFormat.hasOwnProperty(
                                    'delimiter'
                                ) ? dateTimeFormat.delimiter : '-')
                            )
                                for (let pattern:string of [].concat(
                                    dateTimeFormat.pattern
                                )) {
                                    // IgnoreTypeCheck
                                    pattern = (new Function(
                                        'delimiter', `return \`^${pattern}$\``
                                    ))(`${delimiter}+`)
                                    const flags:string =
                                        dateTimeFormat.hasOwnProperty(
                                            'flags'
                                        ) ? dateTimeFormat.flags : ''
                                    // IgnoreTypeCheck
                                    const key:string = pattern + flags
                                    if (!patternPresenceCache.hasOwnProperty(
                                        key
                                    )) {
                                        patternPresenceCache[key] = true
                                        Tools._dateTimePatternCache.push(
                                            // IgnoreTypeCheck
                                            new RegExp(pattern, flags))
                                    }
                                }
            // endregion
        }
        // region pre-process
        value = value.toLowerCase()
        // Reduce each none alphanumeric symbol to a single one.
        value = value.replace(/([^0-9a-z])[^0-9a-z]+/g, '$1')
        let monthNumber:number = 1
        for (const monthVariation:Array<string> of [
            ['jan', 'january?', 'janvier'],
            ['feb', 'february?', 'février'],
            ['m(?:a|ae|ä)r', 'm(?:a|ae|ä)r(?:ch|s|z)'],
            ['ap[rv]', 'a[pv]ril'],
            ['ma[iy]'],
            ['ju[ein]', 'jui?n[ei]?'],
            ['jul', 'jul[iy]', 'juillet'],
            ['aug', 'august', 'août'],
            ['sep', 'septemb(?:er|re)'],
            ['o[ck]t', 'o[ck]tob(?:er|re)'],
            ['nov', 'novemb(?:er|re)'],
            ['de[cz]', 'd[eé][cz]emb(?:er|re)']
        ]) {
            let matched:boolean = false
            for (const name:string of monthVariation) {
                const pattern:RegExp = new RegExp(
                    `(^|[^a-z])${name}([^a-z]|$)`)
                if (pattern.test(value)) {
                    value = value.replace(pattern, `$1${monthNumber}$2`)
                    matched = true
                    break
                }
            }
            if (matched)
                break
            monthNumber += 1
        }
        value = Tools.stringSliceWeekday(value)
        const timezonePattern:RegExp = /(.+)\+(.+)$/
        const timezoneMatch:Array<any>|null = value.match(timezonePattern)
        if (timezoneMatch)
            value = value.replace(timezonePattern, '$1')
        for (const wordToSlice:string of ['', 'Uhr', `o'clock`])
            value = value.replace(wordToSlice, '')
        value = value.trim()
        // endregion
        for (const dateTimePattern:RegExp of Tools._dateTimePatternCache) {
            let match:Array<any>|null = null
            try {
                match = value.match(dateTimePattern)
            } catch (error) {}
            if (match) {
                const get:Function = (
                    name:string, fallback:number = 0
                // IgnoreTypeCheck
                ):number => name in match.groups ?
                    // IgnoreTypeCheck
                    parseInt(match.groups[name]) :
                    fallback
                const parameter:Array<number> = [
                    get('year', 1970), get('month', 1) - 1, get('day', 1),
                    get('hour'), get('minute'), get('second'),
                    get('millisecond')
                ]
                let result:Date|null = null
                if (timezoneMatch) {
                    const timeShift:Date|null = Tools.stringInterpretDateTime(
                        timezoneMatch[2], true)
                    if (timeShift)
                        result = new Date(
                            Date.UTC(...parameter) - timeShift.getTime())
                }
                if (!result)
                    if (interpretAsUTC)
                        result = new Date(Date.UTC(...parameter))
                    else
                        result = new Date(...parameter)
                if (isNaN(result.getDate()))
                    return null
                return result
            }
        }
        return null
    }
    /**
     * Converts a string to its lower case representation.
     * @param string - The string to format.
     * @returns The formatted string.
     */
    static stringLowerCase(string:string):string {
        return string.charAt(0).toLowerCase() + string.substring(1)
    }
    /**
     * Wraps given mark strings in given target with given marker.
     * @param target - String to search for marker.
     * @param words - String or array of strings to search in target for.
     * @param marker - HTML template string to mark.
     * @param normalizer - Pure normalisation function to use before searching
     * for matches.
     * @returns Processed result.
     */
    static stringMark(
        target:?string,
        words:?string|?Array<string>,
        marker:string = '<span class="tools-mark">{1}</span>',
        normalizer:Function = (value:any):string => `${value}`.toLowerCase()
    ):?string {
        if (target && words && words.length) {
            target = target.trim()
            if (!Array.isArray(words))
                words = [words]
            let index:number = 0
            for (const word:string of words) {
                words[index] = normalizer(word).trim()
                index += 1
            }
            let restTarget:string = target
            let offset:number = 0
            while (true) {
                let nearestRange:?Array<number>
                let currentRange:?Array<number>
                for (const word:string of words) {
                    currentRange = Tools.stringFindNormalizedMatchRange(
                        restTarget, word, normalizer)
                    if (currentRange && (
                        !nearestRange || currentRange[0] < nearestRange[0]
                    ))
                        nearestRange = currentRange
                }
                if (nearestRange) {
                    target = target.substring(0, offset + nearestRange[0]) +
                        Tools.stringFormat(marker, target.substring(
                            offset + nearestRange[0], offset + nearestRange[1]
                        )) + target.substring(offset + nearestRange[1])
                    offset += nearestRange[1] + (marker.length - '{1}'.length)
                    if (target.length <= offset)
                        break
                    restTarget = target.substring(offset)
                } else
                    break
            }
        }
        return target
    }
    /**
     * Implements the md5 hash algorithm.
     * @param value - Value to calculate md5 hash for.
     * @param onlyAscii - Set to true if given input has ascii characters only
     * to get more performance.
     * @returns Calculated md5 hash value.
     */
    static stringMD5(value:string, onlyAscii:boolean = false):string {
        const hexCharacters:Array<string> = '0123456789abcdef'.split('')
        // region sub helper
        /**
         * This function is much faster, so if possible we use it. Some IEs
         * are the only ones I know of that need the idiotic second function,
         * generated by an if clause in the end.
         * @param first - First operand to add.
         * @param second - Second operant to add.
         * @returns The sum of both given operands.
        */
        let unsignedModule2PowerOf32Addition = (
            first:number, second:number
        ):number => (first + second) & 0xFFFFFFFF
        // / region primary functions needed for the algorithm
        /*
         * Implements the basic operation for each round of the algorithm.
         */
        const cmn = (
            q:number, a:number, b:number, x:number, s:number, t:number
        ):number => {
            a = unsignedModule2PowerOf32Addition(
                unsignedModule2PowerOf32Addition(a, q),
                unsignedModule2PowerOf32Addition(x, t))
            return unsignedModule2PowerOf32Addition(
                (a << s) | (a >>> (32 - s)), b)
        }
        /**
         * First algorithm part.
         * @param a - Operand.
         * @param b - Operand.
         * @param c - Operand.
         * @param d - Operand.
         * @param x - Operand.
         * @param s - Operand.
         * @param t - Operand.
         * @returns Result.
         */
        const ff = (
            a:number, b:number, c:number, d:number, x:number, s:number,
            t:number
        ):number => cmn((b & c) | ((~b) & d), a, b, x, s, t)
        /**
         * Second algorithm part.
         * @param a - Operand.
         * @param b - Operand.
         * @param c - Operand.
         * @param d - Operand.
         * @param x - Operand.
         * @param s - Operand.
         * @param t - Operand.
         * @returns Result.
         */
        const gg = (
            a:number, b:number, c:number, d:number, x:number, s:number,
            t:number
        ):number => cmn((b & d) | (c & (~d)), a, b, x, s, t)
        /**
         * Third algorithm part.
         * @param a - Operand.
         * @param b - Operand.
         * @param c - Operand.
         * @param d - Operand.
         * @param x - Operand.
         * @param s - Operand.
         * @param t - Operand.
         * @returns Result.
         */
        const hh = (
            a:number, b:number, c:number, d:number, x:number, s:number,
            t:number
        ):number => cmn(b ^ c ^ d, a, b, x, s, t)
        /**
         * Fourth algorithm part.
         * @param a - Operand.
         * @param b - Operand.
         * @param c - Operand.
         * @param d - Operand.
         * @param x - Operand.
         * @param s - Operand.
         * @param t - Operand.
         * @returns Result.
         */
        const ii = (
            a:number, b:number, c:number, d:number, x:number, s:number,
            t:number
        ):number => cmn(c ^ (b | (~d)), a, b, x, s, t)
        /**
         * Performs all 16 needed steps.
         * @param state - Current state.
         * @param blocks - Blocks to cycle through.
         * @returns Returns given state.
         */
        const cycle = (state:Array<any>, blocks:Array<any>):Array<any> => {
            let a:any = state[0]
            let b:any = state[1]
            let c:any = state[2]
            let d:any = state[3]
            // region round 1
            a = ff(a, b, c, d, blocks[0], 7, -680876936)
            d = ff(d, a, b, c, blocks[1], 12, -389564586)
            c = ff(c, d, a, b, blocks[2], 17, 606105819)
            b = ff(b, c, d, a, blocks[3], 22, -1044525330)

            a = ff(a, b, c, d, blocks[4], 7, -176418897)
            d = ff(d, a, b, c, blocks[5], 12, 1200080426)
            c = ff(c, d, a, b, blocks[6], 17, -1473231341)
            b = ff(b, c, d, a, blocks[7], 22, -45705983)

            a = ff(a, b, c, d, blocks[8], 7, 1770035416)
            d = ff(d, a, b, c, blocks[9], 12, -1958414417)
            c = ff(c, d, a, b, blocks[10], 17, -42063)
            b = ff(b, c, d, a, blocks[11], 22, -1990404162)

            a = ff(a, b, c, d, blocks[12], 7, 1804603682)
            d = ff(d, a, b, c, blocks[13], 12, -40341101)
            c = ff(c, d, a, b, blocks[14], 17, -1502002290)
            b = ff(b, c, d, a, blocks[15], 22, 1236535329)
            // endregion
            // region round 2
            a = gg(a, b, c, d, blocks[1], 5, -165796510)
            d = gg(d, a, b, c, blocks[6], 9, -1069501632)
            c = gg(c, d, a, b, blocks[11], 14, 643717713)
            b = gg(b, c, d, a, blocks[0], 20, -373897302)

            a = gg(a, b, c, d, blocks[5], 5, -701558691)
            d = gg(d, a, b, c, blocks[10], 9, 38016083)
            c = gg(c, d, a, b, blocks[15], 14, -660478335)
            b = gg(b, c, d, a, blocks[4], 20, -405537848)

            a = gg(a, b, c, d, blocks[9], 5, 568446438)
            d = gg(d, a, b, c, blocks[14], 9, -1019803690)
            c = gg(c, d, a, b, blocks[3], 14, -187363961)
            b = gg(b, c, d, a, blocks[8], 20, 1163531501)

            a = gg(a, b, c, d, blocks[13], 5, -1444681467)
            d = gg(d, a, b, c, blocks[2], 9, -51403784)
            c = gg(c, d, a, b, blocks[7], 14, 1735328473)
            b = gg(b, c, d, a, blocks[12], 20, -1926607734)
            // endregion
            // region round 3
            a = hh(a, b, c, d, blocks[5], 4, -378558)
            d = hh(d, a, b, c, blocks[8], 11, -2022574463)
            c = hh(c, d, a, b, blocks[11], 16, 1839030562)
            b = hh(b, c, d, a, blocks[14], 23, -35309556)

            a = hh(a, b, c, d, blocks[1], 4, -1530992060)
            d = hh(d, a, b, c, blocks[4], 11, 1272893353)
            c = hh(c, d, a, b, blocks[7], 16, -155497632)
            b = hh(b, c, d, a, blocks[10], 23, -1094730640)

            a = hh(a, b, c, d, blocks[13], 4, 681279174)
            d = hh(d, a, b, c, blocks[0], 11, -358537222)
            c = hh(c, d, a, b, blocks[3], 16, -722521979)
            b = hh(b, c, d, a, blocks[6], 23, 76029189)

            a = hh(a, b, c, d, blocks[9], 4, -640364487)
            d = hh(d, a, b, c, blocks[12], 11, -421815835)
            c = hh(c, d, a, b, blocks[15], 16, 530742520)
            b = hh(b, c, d, a, blocks[2], 23, -995338651)
            // endregion
            // region round 4
            a = ii(a, b, c, d, blocks[0], 6, -198630844)
            d = ii(d, a, b, c, blocks[7], 10, 1126891415)
            c = ii(c, d, a, b, blocks[14], 15, -1416354905)
            b = ii(b, c, d, a, blocks[5], 21, -57434055)

            a = ii(a, b, c, d, blocks[12], 6, 1700485571)
            d = ii(d, a, b, c, blocks[3], 10, -1894986606)
            c = ii(c, d, a, b, blocks[10], 15, -1051523)
            b = ii(b, c, d, a, blocks[1], 21, -2054922799)

            a = ii(a, b, c, d, blocks[8], 6, 1873313359)
            d = ii(d, a, b, c, blocks[15], 10, -30611744)
            c = ii(c, d, a, b, blocks[6], 15, -1560198380)
            b = ii(b, c, d, a, blocks[13], 21, 1309151649)

            a = ii(a, b, c, d, blocks[4], 6, -145523070)
            d = ii(d, a, b, c, blocks[11], 10, -1120210379)
            c = ii(c, d, a, b, blocks[2], 15, 718787259)
            b = ii(b, c, d, a, blocks[9], 21, -343485551)
            // endregion
            state[0] = unsignedModule2PowerOf32Addition(a, state[0])
            state[1] = unsignedModule2PowerOf32Addition(b, state[1])
            state[2] = unsignedModule2PowerOf32Addition(c, state[2])
            state[3] = unsignedModule2PowerOf32Addition(d, state[3])
            return state
        }
        // / endregion
        /**
         * Converts given character to its corresponding hex code
         * representation.
         * @param character - Character to convert.
         * @returns Converted hex code string.
         */
        const convertCharactorToHexCode = (character:any):string => {
            let hexString:string = ''
            for (let round:number = 0; round < 4; round++)
                // NOTE: "+=" can not be used here since the minifier breaks.
                hexString = hexString + hexCharacters[(character >> (
                    round * 8 + 4
                )) & 0x0F] + hexCharacters[(character >> (round * 8)) & 0x0F]
            return hexString
        }
        /**
         * Converts given byte array to its corresponding hex code as string.
         * @param value - Array of characters to convert.
         * @returns Converted hex code.
         */
        const convertToHexCode = (value:Array<any>):string => {
            for (let index:number = 0; index < value.length; index++)
                value[index] = convertCharactorToHexCode(value[index])
            return value.join('')
        }
        /* eslint-disable jsdoc/require-description-complete-sentence */
        /**
         * There needs to be support for unicode here, unless we pretend that
         * we can redefine the md5 algorithm for multi-byte characters
         * (perhaps by adding every four 16-bit characters and shortening the
         * sum to 32 bits). Otherwise I suggest performing md5 as if every
         * character was two bytes e.g., 0040 0025 = @%--but then how will an
         * ordinary md5 sum be matched? There is no way to standardize text
         * to something like utf-8 before transformation; speed cost is
         * utterly prohibitive. The JavaScript standard itself needs to look
         * at this: it should start providing access to strings as preformed
         * utf-8 8-bit unsigned value arrays.
         * @param value - Value to process with each block.
         * @returns Converted byte array.
         */
        const handleBlock = (value:string):Array<any> => {
            const blocks:Array<any> = []
            for (
                let blockNumber:number = 0; blockNumber < 64; blockNumber += 4
            )
                blocks[blockNumber >> 2] = value.charCodeAt(blockNumber) +
                    (value.charCodeAt(blockNumber + 1) << 8) +
                    (value.charCodeAt(blockNumber + 2) << 16) +
                    (value.charCodeAt(blockNumber + 3) << 24)
            return blocks
        }
        /* eslint-enable jsdoc/require-description-complete-sentence */
        // endregion
        /**
         * Triggers the main algorithm to calculate the md5 representation of
         * given value.
         * @param value - String to convert to its md5 representation.
         * @returns Array of blocks.
         */
        const main = (value:string):Array<any> => {
            const length:number = value.length
            const state:Array<any> = [
                1732584193, -271733879, -1732584194, 271733878]
            let blockNumber:number
            for (
                blockNumber = 64; blockNumber <= value.length;
                blockNumber += 64
            )
                cycle(state, handleBlock(value.substring(
                    blockNumber - 64, blockNumber)))
            value = value.substring(blockNumber - 64)
            const tail:Array<number> = [
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            for (blockNumber = 0; blockNumber < value.length; blockNumber++)
                tail[blockNumber >> 2] |= value.charCodeAt(blockNumber) << ((
                    blockNumber % 4
                ) << 3)
            tail[blockNumber >> 2] |= 0x80 << ((blockNumber % 4) << 3)
            if (blockNumber > 55) {
                cycle(state, tail)
                for (let index:number = 0; index < 16; index++)
                    tail[index] = 0
            }
            tail[14] = length * 8
            cycle(state, tail)
            return state
        }
        // region final call
        if (convertToHexCode(main(
            'hello'
        )) !== '5d41402abc4b2a76b9719d911017c592')
            /**
             * This function is much faster, so if possible we use it. Some IEs
             * are the only ones I know of that need the idiotic second
             * function, generated by an if clause in the end.
             * @private
             * @param first - First operand to add.
             * @param second - Second operant to add.
             * @returns The sum of both given operands.
            */
            unsignedModule2PowerOf32Addition = (
                first:number, second:number
            ):number => {
                const lsw = (first & 0xFFFF) + (second & 0xFFFF)
                const msw = (first >> 16) + (second >> 16) + (lsw >> 16)
                return (msw << 16) | (lsw & 0xFFFF)
            }
        return convertToHexCode(main((onlyAscii) ? value : unescape(
            encodeURIComponent(value))))
        // endregion
    }
    /**
     * Normalizes given phone number for automatic dialing or comparison.
     * @param value - Number to normalize.
     * @param dialable - Indicates whether the result should be dialed or
     * represented as lossless data.
     * @returns Normalized number.
     */
    static stringNormalizePhoneNumber(
        value:?string|?number, dialable:boolean=true
    ):string {
        if (typeof value === 'string' || typeof value === 'number') {
            value = `${value}`.trim()
            // Normalize country code prefix.
            value = value.replace(/^[^0-9]*\+/, '00')
            if (dialable)
                return value.replace(/[^0-9]+/g, '')
            const separatorPattern:string = '(?:[ /\\-]+)'
            // Remove unneeded area code zero in brackets.
            value = value.replace(
                new RegExp(
                    `^(.+?)${separatorPattern}?\\(0\\)${separatorPattern}?` +
                    '(.+)$'
                ),
                '$1-$2'
            )
            // Remove unneeded area code brackets.
            value = value.replace(
                new RegExp(
                    `^(.+?)${separatorPattern}?\\((.+)\\)` +
                    `${separatorPattern}?(.+)$`
                ),
                '$1-$2-$3'
            )
            /*
                Remove separators which doesn't mark semantics:
                1: Country code
                2: Area code
                3: Number
            */
            let compiledPattern:RegExp = new RegExp(
                `^(00[0-9]+)${separatorPattern}([0-9]+)${separatorPattern}` +
                '(.+)$'
            )
            if (compiledPattern.test(value))
                // Country code and area code matched.
                value = value.replace(compiledPattern, (
                    match:string,
                    countryCode:string,
                    areaCode:string,
                    number:string
                ):string =>
                    `${countryCode}-${areaCode}-` +
                    Tools.stringSliceAllExceptNumberAndLastSeperator(number)
                )
            else {
                /*
                    One prefix code matched:
                    1: Prefix code
                    2: Number
                */
                compiledPattern = /^([0-9 ]+)[\/-](.+)$/
                const replacer:Function = (
                    match:string, prefixCode:string, number:string
                ):string =>
                    `${prefixCode.replace(/ +/, '')}-` +
                    Tools.stringSliceAllExceptNumberAndLastSeperator(number)
                if (compiledPattern.test(value))
                    // Prefer "/" or "-" over " " as area code separator.
                    value = value.replace(compiledPattern, replacer)
                else
                    value = value.replace(
                        new RegExp(`^([0-9]+)${separatorPattern}(.+)$`),
                        replacer
                    )
            }
            return value.replace(/[^0-9-]+/g, '')
        }
        return ''
    }
    /**
     * Normalizes given zip code for automatic address processing.
     * @param value - Number to normalize.
     * @returns Normalized number.
     */
    static stringNormalizeZipCode(value:?string|?number):string {
        if (typeof value === 'string' || typeof value === 'number')
            return `${value}`.trim().replace(/[^0-9]+/g, '')
        return ''
    }
    /**
     * Converts given serialized, base64 encoded or file path given object into
     * a native javaScript one if possible.
     * @param serializedObject - Object as string.
     * @param scope - An optional scope which will be used to evaluate given
     * object in.
     * @param name - The name under given scope will be available.
     * @returns The parsed object if possible and null otherwise.
     */
    static stringParseEncodedObject(
        serializedObject:string, scope:Object = {}, name:string = 'scope'
    ):?PlainObject {
        if (serializedObject.endsWith('.json') && Tools.isFileSync(
            serializedObject
        ))
            serializedObject = fileSystem.readFileSync(serializedObject, {
                encoding: 'utf-8'})
        serializedObject = serializedObject.trim()
        if (!serializedObject.startsWith('{'))
            serializedObject = eval('Buffer').from(
                serializedObject, 'base64'
            ).toString('utf8')
        let result:any
        try {
            // IgnoreTypeCheck
            result = (new Function(name, `return ${serializedObject}`))(scope)
        } catch (error) {}
        if (typeof result === 'object')
            return result
        return null
    }
    /**
     * Represents given phone number. NOTE: Currently only support german phone
     * numbers.
     * @param value - Number to format.
     * @returns Formatted number.
     */
    static stringRepresentPhoneNumber(value:?string|?number):string {
        if (
            ['number', 'string'].includes(Tools.determineType(value)) &&
            value
        ) {
            // Represent country code and leading area code zero.
            value = `${value}`.replace(
                /^(00|\+)([0-9]+)-([0-9-]+)$/, '+$2 (0) $3')
            // Add German country code if not exists.
            value = value.replace(/^0([1-9][0-9-]+)$/, '+49 (0) $1')
            // Separate area code from base number.
            value = value.replace(/^([^-]+)-([0-9-]+)$/, '$1 / $2')
            // Partition base number in one triple and tuples or tuples only.
            return value.replace(/^(.*?)([0-9]+)(-?[0-9]*)$/, (
                match:string, prefix:string, number:string, suffix:string
            ):string => prefix + (
                (number.length % 2 === 0) ? number.replace(
                    /([0-9]{2})/g, '$1 '
                ) : number.replace(/^([0-9]{3})([0-9]+)$/, (
                    match:string, triple:string, rest:string
                ):string => `${triple} ` + rest.replace(
                    /([0-9]{2})/g, '$1 '
                ).trim()) + suffix).trim()).trim()
        }
        return ''
    }
    /**
     * Slices all none numbers but preserves last separator.
     * @param value - String to process.
     * @returns - Sliced given value.
     */
    static stringSliceAllExceptNumberAndLastSeperator(value:string):string {
        /*
            1: baseNumber
            2: directDialingNumberSuffix
        */
        const compiledPattern:RegExp = /^(.*[0-9].*)-([0-9]+)$/
        if (compiledPattern.test(value))
            return value.replace(compiledPattern, (
                match:string,
                baseNumber:string,
                directDialingNumberSuffix:string
            ):string =>
                `${baseNumber.replace(/[^0-9]+/g, '')}-` +
                directDialingNumberSuffix
            )
        return value.replace(/[^0-9]+/g, '')
    }
    /**
     * Slice weekday from given date representation.
     * @param value - String to process.
     * @returns Sliced given string.
     */
    static stringSliceWeekday(value:string):string {
        const weekdayPattern:RegExp = /[a-z]{2}\.+ *([^ ].*)$/i
        const weekdayMatch:Array<any>|null = value.match(weekdayPattern)
        if (weekdayMatch)
            return value.replace(weekdayPattern, '$1')
        return value
    }
    /**
     * Converts a dom selector to a prefixed dom selector string.
     * @param selector - A dom node selector.
     * @returns Returns given selector prefixed.
     */
    stringNormalizeDomNodeSelector(selector:string):string {
        let domNodeSelectorPrefix:string = ''
        if (this._options.domNodeSelectorPrefix)
            domNodeSelectorPrefix = `${this._options.domNodeSelectorPrefix} `
        if (!(selector.startsWith(domNodeSelectorPrefix) || selector.trim(
        ).startsWith('<')))
            selector = domNodeSelectorPrefix + selector
        return selector.trim()
    }
    // / endregion
    // / region number
    /**
     * Determines corresponding utc timestamp for given date object.
     * @param value - Date to convert.
     * @param inMilliseconds - Indicates whether given number should be in
     * seconds (default) or milliseconds.
     * @returns Determined numerous value.
     */
    static numberGetUTCTimestamp(
        value:any, inMilliseconds:boolean = false
    ):number {
        const date:Date =
            [undefined, null].includes(value) ? new Date() : new Date(value)
        return Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds(),
            date.getUTCMilliseconds()
        ) / (inMilliseconds ? 1 : 1000)
    }
    /**
     * Checks if given object is java scripts native "Number.NaN" object.
     * @param object - Object to Check.
     * @returns Returns whether given value is not a number or not.
     */
    static numberIsNotANumber(object:any):boolean {
        return Tools.determineType(object) === 'number' && isNaN(object)
    }
    /**
     * Rounds a given number accurate to given number of digits.
     * @param number - The number to round.
     * @param digits - The number of digits after comma.
     * @returns Returns the rounded number.
     */
    static numberRound(number:number, digits:number = 0):number {
        return Math.round(number * Math.pow(10, digits)) / Math.pow(10, digits)
    }
    // / endregion
    // / region data transfer
    /**
     * Checks if given url response with given status code.
     * @param url - Url to check reachability.
     * @param wait - Boolean indicating if we should retry until a status code
     * will be given.
     * @param expectedStatusCodes - Status codes to check for.
     * @param timeoutInSeconds - Delay after assuming given resource isn't
     * available if no response is coming.
     * @param pollIntervallInSeconds - Seconds between two tries to reach given
     * url.
     * @param options - Fetch options to use.
     * @returns A promise which will be resolved if a request to given url has
     * finished and resulting status code matches given expectedstatus code.
     * Otherwise returned promise will be rejected.
     */
    static async checkReachability(
        url:string,
        wait:boolean = false,
        expectedStatusCodes:number|Array<number> = 200,
        timeoutInSeconds:number = 10,
        pollIntervallInSeconds:number = 0.1,
        options:PlainObject = {}
    ):Promise<Object> {
        expectedStatusCodes = [].concat(expectedStatusCodes)
        const check:Function = (response:?Object):?Object => {
            if (
                response && 'status' in response &&
                // IgnoreTypeCheck
                !expectedStatusCodes.includes(response.status)
            )
                throw new Error(
                    `Given status code ${response.status} differs from ` +
                    // IgnoreTypeCheck
                    `${expectedStatusCodes.join(', ')}.`)
            return response
        }
        if (wait)
            return new Promise(async (
                resolve:Function, reject:Function
            ):Promise<void> => {
                let timedOut:boolean = false
                const wrapper:Function = async ():Promise<?Object> => {
                    let response:Object
                    try {
                        response = await fetch(url, options)
                    } catch (error) {
                        if (!timedOut) {
                            /* eslint-disable no-use-before-define */
                            currentlyRunningTimer = Tools.timeout(
                                pollIntervallInSeconds * 1000, wrapper)
                            /* eslint-enable no-use-before-define */
                            /*
                                NOTE: A timer rejection is expected. Avoid
                                throwing errors about unhandled promise
                                rejections.
                            */
                            currentlyRunningTimer.catch(Tools.noop)
                        }
                        return error
                    }
                    try {
                        resolve(check(response))
                    } catch (error) {
                        reject(error)
                    } finally {
                        /* eslint-disable no-use-before-define */
                        // IgnoreTypeCheck
                        timer.clear()
                        /* eslint-enable no-use-before-define */
                    }
                    return response
                }
                let currentlyRunningTimer = Tools.timeout(wrapper)
                const timer:Promise<boolean> = Tools.timeout(
                    timeoutInSeconds * 1000)
                try {
                    await timer
                } catch (error) {}
                timedOut = true
                // IgnoreTypeCheck
                currentlyRunningTimer.clear()
                reject(new Error(
                    `Timeout of ${timeoutInSeconds} seconds reached.`))
            })
        return check(await fetch(url, options))
    }
    /**
     * Checks if given url isn't reachable.
     * @param url - Url to check reachability.
     * @param wait - Boolean indicating if we should retry until a status code
     * will be given.
     * @param timeoutInSeconds - Delay after assuming given resource will stay
     * available.
     * @param pollIntervallInSeconds - Seconds between two tries to reach given
     * url.
     * @param unexpectedStatusCodes - Status codes to check for.
     * @param options - Fetch options to use.
     * @returns A promise which will be resolved if a request to given url
     * couldn't finished. Otherwise returned promise will be rejected.
     */
    static async checkUnreachability(
        url:string,
        wait:boolean = false,
        timeoutInSeconds:number = 10,
        pollIntervallInSeconds:number = 0.1,
        unexpectedStatusCodes:?number|Array<number> = null,
        options:PlainObject = {}
    ):Promise<Object> {
        const check:Function = (response:?Object):?Error => {
            if (unexpectedStatusCodes) {
                unexpectedStatusCodes = [].concat(unexpectedStatusCodes)
                if (
                    response &&
                    'status' in response &&
                    unexpectedStatusCodes.includes(response.status)
                )
                    throw new Error(
                        `Given url "${url}" is reachable and responses with ` +
                        `unexpected status code "${response.status}".`)
                return new Error(
                    'Given status code is not "' +
                    `${unexpectedStatusCodes.join(', ')}".`)
            }
        }
        if (wait)
            return new Promise(async (
                resolve:Function, reject:Function
            ):Promise<void> => {
                let timedOut:boolean = false
                const wrapper:Function = async ():Promise<?Object> => {
                    try {
                        const response:Object = await fetch(url, options)
                        if (timedOut)
                            return response
                        const result:Error = check(response)
                        if (result) {
                            // IgnoreTypeCheck
                            timer.clear()
                            resolve(result)
                            return result
                        }
                        /* eslint-disable no-use-before-define */
                        currentlyRunningTimer = Tools.timeout(
                            pollIntervallInSeconds * 1000, wrapper)
                        /* eslint-enable no-use-before-define */
                        /*
                            NOTE: A timer rejection is expected. Avoid throwing
                            errors about unhandled promise rejections.
                        */
                        currentlyRunningTimer.catch(Tools.noop)
                    } catch (error) {
                        /* eslint-disable no-use-before-define */
                        // IgnoreTypeCheck
                        timer.clear()
                        /* eslint-enable no-use-before-define */
                        resolve(error)
                        return error
                    }
                }
                let currentlyRunningTimer = Tools.timeout(wrapper)
                const timer:Promise<boolean> = Tools.timeout(
                    timeoutInSeconds * 1000)
                try {
                    await timer
                } catch (error) {}
                timedOut = true
                // IgnoreTypeCheck
                currentlyRunningTimer.clear()
                reject(new Error(
                    `Timeout of ${timeoutInSeconds} seconds reached.`))
            })
        try {
            const result:Error = check(await fetch(url, options))
            if (result)
                return result
        } catch (error) {
            return error
        }
        throw new Error(`Given url "${url}" is reachable.`)
    }
    /**
     * Send given data to a given iframe.
     * @param target - Name of the target iframe or the target iframe itself.
     * @param url - URL to send to data to.
     * @param data - Data holding object to send data to.
     * @param requestType - The forms action attribute value. If nothing is
     * provided "post" will be used as default.
     * @param removeAfterLoad - Indicates if created iframe should be removed
     * right after load event. Only works if an iframe object is given instead
     * of a simple target name.
     * @returns Returns the given target as extended dom node.
     */
    static sendToIFrame(
        target:$DomNode|DomNode|string,
        url:string,
        data:{[key:string]:any},
        requestType:string = 'post',
        removeAfterLoad:boolean = false
    ):$DomNode {
        const $targetDomNode:$DomNode = (typeof target === 'string') ? $(
            `iframe[name"${target}"]`
        ) : $(target)
        const $formDomNode:$DomNode = $('<form>').attr({
            action: url, method: requestType, target: $targetDomNode.attr(
                'name')})
        for (const name:string in data)
            if (data.hasOwnProperty(name))
                $formDomNode.append($('<input>').attr({
                    type: 'hidden', name, value: data[name]}))
        /*
            NOTE: The given target form have to be injected into document
            object model to successfully submit.
        */
        if (removeAfterLoad)
            $targetDomNode.on('load', ():$DomNode => $targetDomNode.remove())
        $formDomNode.insertAfter($targetDomNode)
        $formDomNode[0].submit()
        $formDomNode.remove()
        return $targetDomNode
    }
    /**
     * Send given data to a temporary created iframe.
     * @param url - URL to send to data to.
     * @param data - Data holding object to send data to.
     * @param requestType - The forms action attribute value. If nothing is
     * provided "post" will be used as default.
     * @param removeAfterLoad - Indicates if created iframe should be removed
     * right after load event.
     * @returns Returns the dynamically created iframe.
     */
    sendToExternalURL(
        url:string,
        data:{[key:string]:any},
        requestType:string = 'post',
        removeAfterLoad:boolean = true
    ):$DomNode {
        const $iFrameDomNode:$DomNode = $('<iframe>').attr(
            'name',
            this.constructor._name.charAt(0).toLowerCase() +
                this.constructor._name.substring(1) +
            (new Date()).getTime()
        ).hide()
        this.$domNode.append($iFrameDomNode)
        this.constructor.sendToIFrame(
            $iFrameDomNode, url, data, requestType, removeAfterLoad)
        return $iFrameDomNode
    }
    // / endregion
    // / region file
    /**
     * Copies given source directory via path to given target directory
     * location with same target name as source file has or copy to given
     * complete target directory path.
     * @param sourcePath - Path to directory to copy.
     * @param targetPath - Target directory or complete directory location to
     * copy in.
     * @param callback - Function to invoke for each traversed file.
     * @param readOptions - Options to use for reading source file.
     * @param writeOptions - Options to use for writing to target file.
     * @returns Promise holding the determined target directory path.
     */
    static copyDirectoryRecursive(
        sourcePath:string, targetPath:string, callback:Function = Tools.noop,
        readOptions:PlainObject = {encoding: null, flag: 'r'},
        writeOptions:PlainObject = {encoding: 'utf8', flag: 'w', mode: 0o666}
    ):Promise<string> {
        return new Promise(async (
            resolve:Function, reject:Function
        ):Promise<void> => {
            // NOTE: Check if folder needs to be created or integrated.
            let isDirectory:boolean
            try {
                isDirectory = await Tools.isDirectory(targetPath)
            } catch (error) {
                return reject(error)
            }
            if (isDirectory)
                targetPath = path.resolve(targetPath, path.basename(
                    sourcePath))
            sourcePath = path.resolve(sourcePath)
            fileSystem.mkdir(targetPath, async (
                error:?Error
            ):Promise<void> => {
                // IgnoreTypeCheck
                if (error && !('code' in error && error.code === 'EEXIST'))
                    return reject(error)
                let files:Array<File>
                try {
                    files = await Tools.walkDirectoryRecursively(
                        sourcePath, callback)
                } catch (error) {
                    return reject(error)
                }
                for (const currentSourceFile:File of files) {
                    const currentTargetPath:string = path.join(
                        targetPath, currentSourceFile.path.substring(
                            sourcePath.length))
                    if (
                        currentSourceFile.stats &&
                        currentSourceFile.stats.isDirectory()
                    )
                        try {
                            fileSystem.mkdirSync(currentTargetPath)
                        } catch (error) {
                            if (!('code' in error && error.code === 'EEXIST'))
                                throw error
                        }
                    else
                        try {
                            await Tools.copyFile(
                                currentSourceFile.path, currentTargetPath,
                                readOptions, writeOptions)
                        } catch (error) {
                            return reject(error)
                        }
                }
                resolve(targetPath)
            })
        })
    }
    /**
     * Copies given source directory via path to given target directory
     * location with same target name as source file has or copy to given
     * complete target directory path.
     * @param sourcePath - Path to directory to copy.
     * @param targetPath - Target directory or complete directory location to
     * copy in.
     * @param callback - Function to invoke for each traversed file.
     * @param readOptions - Options to use for reading source file.
     * @param writeOptions - Options to use for writing to target file.
     * @returns Determined target directory path.
     */
    static copyDirectoryRecursiveSync(
        sourcePath:string, targetPath:string, callback:Function = Tools.noop,
        readOptions:PlainObject = {encoding: null, flag: 'r'},
        writeOptions:PlainObject = {encoding: 'utf8', flag: 'w', mode: 0o666}
    ):string {
        // Check if folder needs to be created or integrated.
        sourcePath = path.resolve(sourcePath)
        if (Tools.isDirectorySync(targetPath))
            targetPath = path.resolve(targetPath, path.basename(sourcePath))
        fileSystem.mkdirSync(targetPath)
        for (
            const currentSourceFile:File of Tools.walkDirectoryRecursivelySync(
                sourcePath, callback)
        ) {
            const currentTargetPath:string = path.join(
                targetPath, currentSourceFile.path.substring(sourcePath.length)
            )
            if (
                currentSourceFile.stats &&
                currentSourceFile.stats.isDirectory()
            )
                fileSystem.mkdirSync(currentTargetPath)
            else
                Tools.copyFileSync(
                    currentSourceFile.path, currentTargetPath, readOptions,
                    writeOptions)
        }
        return targetPath
    }
    /**
     * Copies given source file via path to given target directory location
     * with same target name as source file has or copy to given complete
     * target file path.
     * @param sourcePath - Path to file to copy.
     * @param targetPath - Target directory or complete file location to copy
     * to.
     * @param readOptions - Options to use for reading source file.
     * @param writeOptions - Options to use for writing to target file.
     * @returns Determined target file path.
     */
    static copyFile(
        sourcePath:string, targetPath:string,
        readOptions:PlainObject = {encoding: null, flag: 'r'},
        writeOptions:PlainObject = {encoding: 'utf8', flag: 'w', mode: 0o666}
    ):Promise<string> {
        /*
            NOTE: If target path references a directory a new file with the
            same name will be created.
        */
        return new Promise(async (
            resolve:Function, reject:Function
        ):Promise<void> => {
            let isDirectory:boolean
            try {
                isDirectory = await Tools.isDirectory(targetPath)
            } catch (error) {
                return reject(error)
            }
            if (isDirectory)
                targetPath = path.resolve(targetPath, path.basename(
                    sourcePath))
            fileSystem.readFile(sourcePath, readOptions, (
                error:?Error, data:Object|string
            ):void => {
                if (error)
                    reject(error)
                else
                    fileSystem.writeFile(targetPath, data, writeOptions, (
                        error:?Error
                    ):void => {
                        if (error)
                            reject(error)
                        else
                            resolve(targetPath)
                    })
            })
        })
    }
    /**
     * Copies given source file via path to given target directory location
     * with same target name as source file has or copy to given complete
     * target file path.
     * @param sourcePath - Path to file to copy.
     * @param targetPath - Target directory or complete file location to copy
     * to.
     * @param readOptions - Options to use for reading source file.
     * @param writeOptions - Options to use for writing to target file.
     * @returns Determined target file path.
     */
    static copyFileSync(
        sourcePath:string, targetPath:string,
        readOptions:PlainObject = {encoding: null, flag: 'r'},
        writeOptions:PlainObject = {encoding: 'utf8', flag: 'w', mode: 0o666}
    ):string {
        /*
            NOTE: If target path references a directory a new file with the
            same name will be created.
        */
        if (Tools.isDirectorySync(targetPath))
            targetPath = path.resolve(targetPath, path.basename(sourcePath))
        fileSystem.writeFileSync(targetPath, fileSystem.readFileSync(
            sourcePath, readOptions
        ), writeOptions)
        return targetPath
    }
    /**
     * Checks if given path points to a valid directory.
     * @param filePath - Path to directory.
     * @returns A promise holding a boolean which indicates directory
     * existents.
     */
    static isDirectory(filePath:string):Promise<boolean> {
        return new Promise((resolve:Function, reject:Function):void =>
            fileSystem.stat(filePath, (
                error:?Error, stats:Object
            ):void => {
                if (error)
                    if (error.hasOwnProperty(
                        'code'
                    // IgnoreTypeCheck
                    ) && ['ENOENT', 'ENOTDIR'].includes(error.code))
                        resolve(false)
                    else
                        reject(error)
                else
                    resolve(stats.isDirectory())
            }))
    }
    /**
     * Checks if given path points to a valid directory.
     * @param filePath - Path to directory.
     * @returns A boolean which indicates directory existents.
     */
    static isDirectorySync(filePath:string):boolean {
        try {
            return fileSystem.statSync(filePath).isDirectory()
        } catch (error) {
            if (error.hasOwnProperty(
                'code'
            ) && ['ENOENT', 'ENOTDIR'].includes(error.code))
                return false
            throw error
        }
    }
    /**
     * Checks if given path points to a valid file.
     * @param filePath - Path to directory.
     * @returns A promise holding a boolean which indicates directory
     * existents.
     */
    static isFile(filePath:string):Promise<boolean> {
        return new Promise((resolve:Function, reject:Function):void =>
            fileSystem.stat(filePath, (error:?Error, stats:Object):void => {
                if (error)
                    if (error.hasOwnProperty(
                        'code'
                    // IgnoreTypeCheck
                    ) && ['ENOENT', 'ENOTDIR'].includes(error.code))
                        resolve(false)
                    else
                        reject(error)
                else
                    resolve(stats.isFile())
            }))
    }
    /**
     * Checks if given path points to a valid file.
     * @param filePath - Path to file.
     * @returns A boolean which indicates file existents.
     */
    static isFileSync(filePath:string):boolean {
        try {
            return fileSystem.statSync(filePath).isFile()
        } catch (error) {
            if (error.hasOwnProperty(
                'code'
            ) && ['ENOENT', 'ENOTDIR'].includes(error.code))
                return false
            throw error
        }
    }
    /**
     * Iterates through given directory structure recursively and calls given
     * callback for each found file. Callback gets file path and corresponding
     * stat object as argument.
     * @param directoryPath - Path to directory structure to traverse.
     * @param callback - Function to invoke for each traversed file and
     * potentially manipulate further traversing.
     * @param options - Options to use for nested "readdir" calls.
     * @returns A promise holding the determined files.
     */
    static walkDirectoryRecursively(
        directoryPath:string, callback:Function = Tools.noop,
        options:PlainObject|string = 'utf8'
    ):Promise<Array<File>> {
        return new Promise((resolve:Function, reject:Function):void =>
            fileSystem.readdir(directoryPath, options, async (
                error:?Object, fileNames:Array<string>
            ):Promise<void> => {
                if (error)
                    return reject(error)
                const files:Array<File> = []
                const statsPromises:Array<Promise<void>> = []
                for (const fileName:string of fileNames) {
                    const filePath:string = path.resolve(
                        directoryPath, fileName)
                    statsPromises.push(new Promise((resolve:Function):void =>
                        fileSystem.stat(filePath, (
                            error:?Error, stats:Object
                        ):void => {
                            files.push({
                                directoryPath,
                                error: error || null,
                                name: fileName,
                                path: filePath,
                                stats: stats || null
                            })
                            resolve()
                        })
                    ))
                }
                await Promise.all(statsPromises)
                if (callback)
                    /*
                        NOTE: Directories have to be iterated first to
                        potentially avoid deeper iterations.
                    */
                    files.sort((firstFile:File, secondFile:File):number => {
                        if (firstFile.error) {
                            if (secondFile.error)
                                return 0
                            return 1
                        }
                        if (firstFile.stats && firstFile.stats.isDirectory()) {
                            if (
                                secondFile.error ||
                                secondFile.stats &&
                                secondFile.stats.isDirectory()
                            )
                                return 0
                            return -1
                        }
                        if (secondFile.error)
                            return -1
                        if (secondFile.stats && secondFile.stats.isDirectory())
                            return 1
                        return 0
                    })
                let finalFiles:Array<File> = []
                for (const file:File of files) {
                    finalFiles.push(file)
                    let result:any = callback(file)
                    if (result === null)
                        break
                    if (typeof result === 'object' && 'then' in result)
                        result = await result
                    if (result === null)
                        break
                    if (
                        result !== false &&
                        file.stats &&
                        file.stats.isDirectory()
                    )
                        finalFiles = finalFiles.concat(
                            await Tools.walkDirectoryRecursively(
                                file.path, callback))
                }
                resolve(finalFiles)
            }))
    }
    /**
     * Iterates through given directory structure recursively and calls given
     * callback for each found file. Callback gets file path and corresponding
     * stats object as argument.
     * @param directoryPath - Path to directory structure to traverse.
     * @param callback - Function to invoke for each traversed file.
     * @param options - Options to use for nested "readdir" calls.
     * @returns Determined list if all files.
     */
    static walkDirectoryRecursivelySync(
        directoryPath:string, callback:Function = Tools.noop,
        options:PlainObject|string = 'utf8'
    ):Array<File> {
        const files:Array<File> = []
        for (const fileName:string of fileSystem.readdirSync(
            directoryPath, options
        )) {
            const filePath:string = path.resolve(directoryPath, fileName)
            const file:File = {
                directoryPath,
                error: null,
                name: fileName,
                path: filePath,
                stats: null
            }
            try {
                file.stats = fileSystem.statSync(filePath)
            } catch (error) {
                file.error = error
            }
            files.push(file)
        }
        if (callback)
            /*
                NOTE: Directories have to be iterated first to potentially
                avoid deeper iterations.
            */
            files.sort((firstFile:File, secondFile:File):number => {
                if (firstFile.error) {
                    if (secondFile.error)
                        return 0
                    return 1
                }
                if (firstFile.stats && firstFile.stats.isDirectory()) {
                    if (
                        secondFile.error ||
                        secondFile.stats &&
                        secondFile.stats.isDirectory()
                    )
                        return 0
                    return -1
                }
                if (secondFile.error)
                    return -1
                if (secondFile.stats && secondFile.stats.isDirectory())
                    return 1
                return 0
            })
        let finalFiles:Array<File> = []
        for (const file:File of files) {
            finalFiles.push(file)
            const result:any = callback(file)
            if (result === null)
                break
            if (
                result !== false &&
                file.stats &&
                file.stats.isDirectory()
            )
                finalFiles = finalFiles.concat(
                    Tools.walkDirectoryRecursivelySync(file.path, callback))
        }
        return finalFiles
    }
    // / endregion
    // / region process handler
    /**
     * Generates a one shot close handler which triggers given promise methods.
     * If a reason is provided it will be given as resolve target. An Error
     * will be generated if return code is not zero. The generated Error has
     * a property "returnCode" which provides corresponding process return
     * code.
     * @param resolve - Promise's resolve function.
     * @param reject - Promise's reject function.
     * @param reason - Promise target if process has a zero return code.
     * @param callback - Optional function to call of process has successfully
     * finished.
     * @returns Process close handler function.
     */
    static getProcessCloseHandler(
        resolve:Function, reject:Function, reason:any = null,
        callback:Function = ():void => {}
    ):((returnCode:?number) => void) {
        let finished:boolean = false
        return (returnCode:?number, ...parameter:Array<any>):void => {
            if (finished)
                finished = true
            else {
                finished = true
                if (typeof returnCode !== 'number' || returnCode === 0) {
                    callback()
                    resolve({reason, parameter})
                } else {
                    const error:Error = new Error(
                        `Task exited with error code ${returnCode}`)
                    // IgnoreTypeCheck
                    error.returnCode = returnCode
                    // IgnoreTypeCheck
                    error.parameter = parameter
                    reject(error)
                }
            }
        }
    }
    /**
     * Forwards given child process communication channels to corresponding
     * current process communication channels.
     * @param childProcess - Child process meta data.
     * @returns Given child process meta data.
     */
    static handleChildProcess(childProcess:ChildProcess):ChildProcess {
        childProcess.stdout.pipe(process.stdout)
        childProcess.stderr.pipe(process.stderr)
        childProcess.on('close', (returnCode:number):void => {
            if (returnCode !== 0)
                console.error(`Task exited with error code ${returnCode}`)
        })
        return childProcess
    }
    // endregion
    // endregion
    // region protected methods
    /* eslint-disable jsdoc/require-description-complete-sentence */
    /**
     * Helper method for attach event handler methods and their event handler
     * remove pendants.
     * @param parameter - Arguments object given to methods like "bind()" or
     * "unbind()".
     * @param removeEvent - Indicates if "unbind()" or "bind()" was given.
     * @param eventFunctionName - Name of function to wrap.
     * @returns Returns $'s wrapped dom node.
     */
    _bindEventHelper(
        parameter:Array<any>,
        removeEvent:boolean = false,
        eventFunctionName:string = 'on'
    ):$DomNode {
    /* eslint-enable jsdoc/require-description-complete-sentence */
        const $domNode:$DomNode = $(parameter[0])
        if (this.constructor.determineType(
            parameter[1]
        ) === 'object' && !removeEvent) {
            for (const eventType:string in parameter[1])
                if (parameter[1].hasOwnProperty(eventType))
                    // IgnoreTypeCheck
                    this[eventFunctionName](
                        $domNode, eventType, parameter[1][eventType])
            return $domNode
        }
        parameter = this.constructor.arrayMake(parameter).slice(1)
        if (parameter.length === 0)
            parameter.push('')
        if (!parameter[0].includes('.'))
            parameter[0] += `.${this.constructor._name}`
        if (removeEvent)
            return $domNode[eventFunctionName](...parameter)
        return $domNode[eventFunctionName](...parameter)
    }
    // endregion
}
export default Tools
// endregion
// region handle $ extending
if ('fn' in $)
    $.fn.Tools = function(...parameter:Array<any>):any {
        return (new Tools()).controller(Tools, parameter, this)
    }
$.Tools = (...parameter:Array<any>):any => (new Tools()).controller(
    Tools, parameter)
$.Tools.class = Tools
if ('fn' in $) {
    // region prop fix for comments and text nodes
    const nativePropFunction = $.fn.prop
    /**
     * JQuery's native prop implementation ignores properties for text nodes,
     * comments and attribute nodes.
     * @param key - Name of property to retrieve from current dom node.
     * @param additionalParameter - Additional parameter will be forwarded to
     * native prop function also.
     * @returns Returns value if used as getter or current dom node if used as
     * setter.
     */
    $.fn.prop = function(key:string, ...additionalParameter:Array<any>):any {
        if (additionalParameter.length < 2 && this.length && [
            '#text', '#comment'
        ].includes(this[0].nodeName) && key in this[0]) {
            if (additionalParameter.length === 0)
                return this[0][key]
            if (additionalParameter.length === 1) {
                this[0][key] = additionalParameter[0]
                return this
            }
        }
        return nativePropFunction.call(this, key, ...additionalParameter)
    }
    // endregion
    // region fix script loading errors with canceling requests after dom ready
    $.readyException = (error:Error|string):void => {
        if (!(typeof error === 'string' && error === 'canceled'))
            throw error
    }
    // endregion
}
// endregion
// region vim modline
// vim: set tabstop=4 shiftwidth=4 expandtab:
// vim: foldmethod=marker foldmarker=region,endregion:
// endregion
