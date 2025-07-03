import { format } from 'date-fns';
import { ScrapeResult, TelegramPost, TelegramChannel } from '../types/telegram.types.js';

export class MarkdownFormatter {
  format(result: ScrapeResult): string {
    const sections: string[] = [];
    
    // Header
    sections.push(this.formatHeader(result));
    
    // Channel info
    sections.push(this.formatChannelInfo(result.channel));
    
    // Summary
    sections.push(this.formatSummary(result));
    
    // Posts
    if (result.posts.length > 0) {
      sections.push(this.formatPosts(result.posts));
    }
    
    // Footer
    sections.push(this.formatFooter(result));
    
    return sections.join('\n\n');
  }

  private formatHeader(result: ScrapeResult): string {
    return `# Telegram Channel Scrape Report\n\n**Generated at:** ${format(result.scrapedAt, 'yyyy-MM-dd HH:mm:ss')}`;
  }

  private formatChannelInfo(channel: TelegramChannel): string {
    const lines = [
      '## Channel Information',
      '',
      `**Name:** ${channel.name}${channel.verified ? ' ✓' : ''}`,
      `**Username:** @${channel.username}`,
    ];
    
    if (channel.description) {
      lines.push(`**Description:** ${channel.description}`);
    }
    
    if (channel.subscriberCount) {
      lines.push(`**Subscribers:** ${channel.subscriberCount.toLocaleString()}`);
    }
    
    return lines.join('\n');
  }

  private formatSummary(result: ScrapeResult): string {
    const lines = [
      '## Summary',
      '',
      `- **Total posts scraped:** ${result.posts.length}`,
      `- **Total posts in channel:** ${result.totalPosts}`,
    ];
    
    if (result.posts.length > 0) {
      const dateRange = this.getDateRange(result.posts);
      lines.push(`- **Date range:** ${dateRange.start} to ${dateRange.end}`);
      
      const stats = this.calculateStats(result.posts);
      lines.push(`- **Average views:** ${stats.avgViews.toLocaleString()}`);
      lines.push(`- **Total reactions:** ${stats.totalReactions.toLocaleString()}`);
      lines.push(`- **Posts with media:** ${stats.postsWithMedia} (${stats.mediaPercentage}%)`);
    }
    
    return lines.join('\n');
  }

  private formatPosts(posts: TelegramPost[]): string {
    const lines = ['## Posts', ''];
    
    // Group posts by date
    const postsByDate = this.groupPostsByDate(posts);
    
    for (const [date, datePosts] of Object.entries(postsByDate)) {
      lines.push(`### ${date}`);
      lines.push('');
      
      for (const post of datePosts || []) {
        lines.push(this.formatPost(post));
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }

  private formatPost(post: TelegramPost): string {
    const lines = [`#### Post ${post.id}`];
    
    lines.push(`**Time:** ${format(post.date, 'HH:mm:ss')}`);
    
    if (post.views) {
      lines.push(`**Views:** ${post.views.toLocaleString()}`);
    }
    
    if (post.reactions && post.reactions.length > 0) {
      const reactionsStr = post.reactions
        .map(r => `${r.emoji} ${r.count}`)
        .join(' · ');
      lines.push(`**Reactions:** ${reactionsStr}`);
    }
    
    if (post.hasMedia && post.mediaTypes) {
      lines.push(`**Media:** ${post.mediaTypes.join(', ')}`);
    }
    
    lines.push('');
    lines.push('**Content:**');
    lines.push('```');
    lines.push(post.content);
    lines.push('```');
    
    return lines.join('\n');
  }

  private formatFooter(result: ScrapeResult): string {
    const lines = ['---'];
    
    if (result.error) {
      lines.push(`\n⚠️ **Warning:** ${result.error}`);
    }
    
    lines.push(`\n*Scraped by Telegram MCP Server v0.2.0*`);
    
    return lines.join('\n');
  }

  private groupPostsByDate(posts: TelegramPost[]): Record<string, TelegramPost[]> {
    const grouped: Record<string, TelegramPost[]> = {};
    
    for (const post of posts) {
      const dateKey = format(post.date, 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(post);
    }
    
    // Sort dates in descending order
    const sortedGrouped: Record<string, TelegramPost[]> = {};
    Object.keys(grouped)
      .sort((a, b) => b.localeCompare(a))
      .forEach(key => {
        sortedGrouped[key] = grouped[key]!;
      });
    
    return sortedGrouped;
  }

  private getDateRange(posts: TelegramPost[]): { start: string; end: string } {
    const dates = posts.map(p => p.date);
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    return {
      start: format(minDate, 'yyyy-MM-dd'),
      end: format(maxDate, 'yyyy-MM-dd')
    };
  }

  private calculateStats(posts: TelegramPost[]) {
    const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
    const avgViews = Math.round(totalViews / posts.length) || 0;
    
    const totalReactions = posts.reduce((sum, p) => {
      const postReactions = p.reactions?.reduce((s, r) => s + r.count, 0) || 0;
      return sum + postReactions;
    }, 0);
    
    const postsWithMedia = posts.filter(p => p.hasMedia).length;
    const mediaPercentage = Math.round((postsWithMedia / posts.length) * 100) || 0;
    
    return {
      avgViews,
      totalReactions,
      postsWithMedia,
      mediaPercentage
    };
  }
}