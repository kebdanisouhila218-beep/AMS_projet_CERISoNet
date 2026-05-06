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
  @Input() sortOption: string = 'recent';
  @Input() filterHashtag: string = '';
  @Input() filterAuthor: string = '';
  @Input() availableHashtags: string[] = [];
  @Input() totalPosts: number = 0;

  // Événements envoyés vers Wall
  @Output() sortChange = new EventEmitter<string>();
  @Output() hashtagChange = new EventEmitter<string>();
  @Output() resetFilters = new EventEmitter<void>();
}