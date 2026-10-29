package ai.otgyeol.image;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ImageProcessingRepository extends JpaRepository<ImageProcessing, Long> {

    List<ImageProcessing> findByResultImageIdIn(Collection<Long> resultImageIds);

    List<ImageProcessing> findBySourceImageIdIn(Collection<Long> sourceImageIds);
}
