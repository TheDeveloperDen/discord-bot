import { Command, ExecutableSubcommand } from 'djs-slash-helper'
import {
  ApplicationCommandOptionType,
  ApplicationCommandType
} from 'discord-api-types/v10'
import { FAQ } from '../../store/models/FAQ.js'
import { createFaqEmbed } from './faq.util.js'
import createFaqModal from './faq.modal.js'
import { moduleManager } from '../../index.js'
import { databaseInit } from '../../store/storage.js'

const choices: Array<{ name: string, value: string }> = []

async function updateChoices () {
  await databaseInit
  const result = await FAQ.findAll()
  choices.length = 0
  choices.push(...result.map(it => ({
    name: it.name,
    value: it.name
  })))
}

await updateChoices()

const GetSubcommand: ExecutableSubcommand = {
  type: ApplicationCommandOptionType.Subcommand,
  name: 'get',
  description: 'Get a FAQ entry\'s content',
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: 'name',
      description: 'The name of the FAQ',
      required: true,
      choices
    }],
  async handle (interaction) {
    const name = interaction.options.get('name')?.value as string | null
    const faq = await FAQ.findOne({ where: { name } })
    if (faq == null) {
      return await interaction.reply({
        ephemeral: true,
        content: 'No FAQ found with this name'
      })
    }
    return await interaction.reply({ embeds: [createFaqEmbed(faq)] })
  }
}

const EditSubcommand: ExecutableSubcommand = {
  type: ApplicationCommandOptionType.Subcommand,
  name: 'edit',
  description: 'Edit a FAQ entry, or create a new one if it doesn\'t exist',
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: 'name',
      description: 'The name of the FAQ',
      required: true
    }],
  async handle (interaction) {
    const name = interaction.options.get('name')?.value as string | null
    if (name == null) {
      return await interaction.reply({
        ephemeral: true,
        content: 'No FAQ name provided'
      })
    }
    const faq = await FAQ.findOne({ where: { name } })

    const modal = createFaqModal(faq ?? undefined)

    await interaction.showModal(modal)
    const response = await interaction.awaitModalSubmit({ time: 2 ** 31 - 1 })
    const title = response.fields.getTextInputValue('titleField')
    const content = response.fields.getTextInputValue('faqContentField')

    await FAQ.upsert({
      id: faq?.id,
      name,
      title,
      content,
      author: interaction.user.id
    })
    await response.reply({
      ephemeral: true,
      content: `FAQ named ${name} created`
    })

    await updateChoices()
    return await moduleManager.refreshCommands()
  }
}

const DeleteSubcommand: ExecutableSubcommand = {
  type: ApplicationCommandOptionType.Subcommand,
  name: 'delete',
  description: 'Delete a FAQ entry',
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: 'name',
      description: 'The name of the FAQ',
      required: true,
      choices
    }],
  async handle (interaction) {
    const name = interaction.options.get('name')?.value as string | null
    if (name == null) {
      return await interaction.reply({
        ephemeral: true,
        content: 'No FAQ name provided'
      })
    }

    const faq = await FAQ.findOne({ where: { name } })
    if (faq == null) {
      return await interaction.reply({
        ephemeral: true,
        content: 'No FAQ found with this name'
      })
    }
    await faq.destroy()
    await updateChoices()
    await moduleManager.refreshCommands()
    return await interaction.reply({
      ephemeral: true,
      content: `FAQ named ${name} deleted`
    })
  }
}

export const FaqCommand: Command<ApplicationCommandType.ChatInput> = {
  name: 'faq',
  description: 'Get / set FAQs',
  type: ApplicationCommandType.ChatInput,
  options: [GetSubcommand, EditSubcommand, DeleteSubcommand],
  handle () {
  }
}
