import Module from '../module.js'
import {LearningCommand} from './learning.command.js'
import {updateAllResources} from "./resourcesCache.util";

export const LearningModule: Module = {
    name: 'learning',
    commands: [LearningCommand],
    onInit: updateAllResources
}
