package ai.otgyeol.label;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 검색 → 그 검색의 근거가 된 택 판독. */
@Entity
@Table(name = "label_extraction_searches")
public class LabelExtractionSearch {

    @Id
    public Long searchId;

    public Long extractionId;

    protected LabelExtractionSearch() {
    }

    public LabelExtractionSearch(Long searchId, Long extractionId) {
        this.searchId = searchId;
        this.extractionId = extractionId;
    }
}
