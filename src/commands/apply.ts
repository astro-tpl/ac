/**
 * Apply 命令 - 将模板应用到项目文件
 */

import { Command, Flags } from '@oclif/core'
import { applyService } from '../core/apply.service'
import { logger } from '../infra/logger'
import { renderTable, renderKeyValue } from '../presentation/table'

export default class Apply extends Command {
  static override description = '将模板应用到项目文件。支持 context/prompt/原始内容三种来源'

  static override examples = [
    '<%= config.bin %> <%= command.id %> --context cursor-default',
    '<%= config.bin %> <%= command.id %> --prompt code_principles --dest ./prompt.md',
    '<%= config.bin %> <%= command.id %> --content ./template.txt --dest ./output.txt',
    '<%= config.bin %> <%= command.id %> --context cursor-default --dry-run',
    '<%= config.bin %> <%= command.id %> --prompt code_principles --dest docs/ --filename principles.md'
  ]

  static override flags = {
    context: Flags.string({
      description: '加载类型为 context 的模板并按 targets 写入',
      exclusive: ['prompt', 'content', 'stdin']
    }),
    prompt: Flags.string({
      description: '加载类型为 prompt 的模板，将其 content 写入指定文件',
      exclusive: ['context', 'content', 'stdin']
    }),
    content: Flags.string({
      description: '使用本地文件的文本内容直接写入指定路径',
      exclusive: ['context', 'prompt', 'stdin']
    }),
    stdin: Flags.boolean({
      description: '从标准输入读取要写入的文本',
      exclusive: ['context', 'prompt', 'content']
    }),
    dest: Flags.string({
      description: '目标目录或文件路径',
      helpValue: './output'
    }),
    filename: Flags.string({
      description: '当 --dest 是目录且来源为 prompt/content/stdin 时，指定落地文件名',
      helpValue: 'output.md'
    }),
    mode: Flags.string({
      description: '写入模式',
      options: ['write', 'append', 'merge'],
      default: 'write'
    }),
    repo: Flags.string({
      description: '在多仓场景下显式指定模板来源仓库的别名',
      helpValue: 'templates'
    }),
    global: Flags.boolean({
      description: '强制使用并操作全局配置',
      default: false
    }),
    'dry-run': Flags.boolean({
      description: '只展示将要修改的文件/模式/预览，不执行实际写入',
      default: false
    })
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Apply)
    
    try {
      const result = await applyService.applyTemplate({
        context: flags.context,
        prompt: flags.prompt,
        content: flags.content,
        stdin: flags.stdin,
        dest: flags.dest,
        filename: flags.filename,
        mode: flags.mode as 'write' | 'append' | 'merge',
        repo: flags.repo,
        forceGlobal: flags.global,
        dryRun: flags['dry-run']
      })
      
      if (flags['dry-run'] && result) {
        this.displayDryRunResult(result)
      }
      
    } catch (error: any) {
      logger.error('应用模板失败', error)
      this.exit(1)
    }
  }
  
  /**
   * 显示预览结果
   */
  private displayDryRunResult(result: {
    results: Array<{
      targetPath: string
      mode: string
      isNewFile: boolean
      contentSummary: string
      jsonKeyDiff?: {
        added: string[]
        modified: string[]
      }
    }>
    totalFiles: number
  }): void {
    logger.info(`预览模式 - 将要修改 ${result.totalFiles} 个文件:`)
    logger.plain('')
    
    for (let i = 0; i < result.results.length; i++) {
      const item = result.results[i]
      
      logger.plain(`📄 文件 ${i + 1}: ${item.targetPath}`)
      
      const details = {
        '状态': item.isNewFile ? '新建文件' : '修改现有文件',
        '模式': item.mode,
        '内容': item.contentSummary
      }
      
      logger.plain(renderKeyValue(details, { indent: 2 }))
      
      // 显示 JSON 合并差异
      if (item.jsonKeyDiff) {
        logger.plain('  JSON 合并差异:')
        
        if (item.jsonKeyDiff.added.length > 0) {
          logger.plain(`    新增键: ${item.jsonKeyDiff.added.join(', ')}`)
        }
        
        if (item.jsonKeyDiff.modified.length > 0) {
          logger.plain(`    修改键: ${item.jsonKeyDiff.modified.join(', ')}`)
        }
      }
      
      logger.plain('')
    }
    
    logger.info('使用不带 --dry-run 的命令来实际执行写入操作')
  }
}
