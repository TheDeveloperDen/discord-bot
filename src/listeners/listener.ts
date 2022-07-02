import {MarkedClient} from '../MarkedClient.js'
import {messageLoggerListener} from './messageLogger.js'
import {languageStatusListener} from './languageStatus.js'
import {joinLeaveListener} from './joinLeaveMessages.js'
import xpHandler from '../xp/xpHandler.js'
import {showcaseListener} from './showcase.js'
import {roleChangeListener} from '../xp/roleUpdates.js'
import {pastebinListener} from './pastebin.js'
import {tokenScanner} from './tokenScanner.js'
import {hotTakeListener} from '../hotTakeSender.js'
import * as commandListener from './commandListener.js'
import {askToAskListener} from './askToAsk.js'
import {faqListener} from './faqListener.js'

/**
 * @deprecated
 */
export type Listener = (client: MarkedClient) => void;

/**
 * @deprecated
 */
export const listeners = [xpHandler,
	messageLoggerListener,
	roleChangeListener,
	joinLeaveListener,
	languageStatusListener,
	pastebinListener,
	tokenScanner,
	hotTakeListener,
	showcaseListener,
	askToAskListener,
	faqListener,
	commandListener.handle]
