import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.css'
})
export class FilterBarComponent {
  // Données reçues depuis Wall
  @Input() availableHashtags: string[] = [];
  @Input() totalPosts: number = 0;

  // Événement unique envoyé vers Wall avec les filtres actifs
  @Output() filtersChanged = new EventEmitter<{ sort: string; hashtag: string; author: string }>();

  // État local des filtres (plus de @Input pour sortOption/filterHashtag/filterAuthor)
  sortOption: string = 'recent';
  filterHashtag: string = '';
  filterAuthor: string = '';

  // Appelé quand le tri change
  onSortChange(): void {
    this.emitFilters();
  }

  // Appelé quand le hashtag change
  onHashtagChange(): void {
    this.emitFilters();
  }
  onAuthorChange(): void {
  this.emitFilters();
}
@Input() availableAuthors: { id: number; name: string }[] = [];

  // Remet tous les filtres à zéro
  resetFilters(): void {
    this.sortOption = 'recent';
    this.filterHashtag = '';
    this.filterAuthor = '';
    this.emitFilters();
  }

  // Émet les filtres courants vers Wall
  private emitFilters(): void {
    this.filtersChanged.emit({
      sort: this.sortOption,
      hashtag: this.filterHashtag,
      author: this.filterAuthor
    });
  }
}